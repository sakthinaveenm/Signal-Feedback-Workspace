import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Project, Feedback } from './models';
import { CreateProjectDto, UpdateProjectDto, CreateFeedbackDto, SubmitFeedbackDto, UpdateFeedbackDto, FeedbackFilterDto, ListFeedbackDto } from './dto';
import { hashKey } from './auth';

export function csvCell(value: unknown) {
  let text = String(value ?? '');
  // Prevent spreadsheet formula execution, including leading whitespace/control characters.
  if (/^[\s\x00-\x1f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
@Injectable()
export class SignalService {
  constructor(@InjectModel(Project.name) private readonly projects: Model<Project>,
    @InjectModel(Feedback.name) private readonly feedback: Model<Feedback>) {}

  listProjects() { return this.projects.find().sort({ createdAt: -1, _id: -1 }).exec(); }
  async getProject(id: string) {
    const project = await this.projects.findById(id).exec();
    if (!project) throw new NotFoundException('Project not found.');
    return project;
  }
  async createProject(dto: CreateProjectDto) {
    const ingestionKey = randomBytes(32).toString('hex');
    const project = await this.projects.create({ ...dto, ingestionKeyHash: hashKey(ingestionKey) });
    return { project: project.toJSON(), ingestionKey };
  }
  async updateProject(id: string, dto: UpdateProjectDto) {
    const project = await this.projects.findByIdAndUpdate(id, { $set: dto }, { new: true, runValidators: true }).exec();
    if (!project) throw new NotFoundException('Project not found.');
    return project;
  }
  async rotateKey(id: string) {
    const ingestionKey = randomBytes(32).toString('hex');
    const project = await this.projects.findByIdAndUpdate(id, { ingestionKeyHash: hashKey(ingestionKey) }, { new: true }).exec();
    if (!project) throw new NotFoundException('Project not found.');
    return { projectId: id, ingestionKey };
  }
  async createFeedback(dto: CreateFeedbackDto) {
    const project = await this.getProject(dto.projectId);
    if (project.archived) throw new NotFoundException('Project is archived.');
    return this.feedback.create(dto);
  }
  async submitFeedback(projectId: string, key: string, dto: SubmitFeedbackDto) {
    const project = await this.projects.findOne({ _id: projectId, archived: false }).select('+ingestionKeyHash').exec();
    if (!key || !project || !timingSafeEqual(Buffer.from(hashKey(key)), Buffer.from(project.ingestionKeyHash))) {
      throw new UnauthorizedException('Invalid project submission credentials.');
    }
    const report = await this.feedback.create({ ...dto, projectId, priority: 'Medium', status: 'New' });
    // Submission clients cannot retrieve internal notes or other reports.
    return { id: report._id, status: report.status, createdAt: report.createdAt };
  }
  private filter(query: FeedbackFilterDto): FilterQuery<Feedback> {
    const filter: FilterQuery<Feedback> = {};
    for (const field of ['projectId', 'status', 'priority', 'type', 'source'] as const) {
      if (query[field] !== undefined) filter[field] = query[field];
    }
    if (query.search?.trim()) {
      const escaped = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = ['title', 'description', 'contact'].map(field => ({ [field]: { $regex: escaped, $options: 'i' } }));
    }
    return filter;
  }
  async listFeedback(query: ListFeedbackDto) {
    const filter = this.filter(query);
    const [items, total] = await Promise.all([
      this.feedback.find(filter).sort({ createdAt: -1, _id: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).exec(),
      this.feedback.countDocuments(filter).exec(),
    ]);
    return { items, total, page: query.page, limit: query.limit, pages: Math.ceil(total / query.limit) };
  }
  async getFeedback(id: string) {
    const report = await this.feedback.findById(id).exec();
    if (!report) throw new NotFoundException('Feedback not found.');
    return report;
  }
  async updateFeedback(id: string, dto: UpdateFeedbackDto) {
    const report = await this.feedback.findByIdAndUpdate(id, { $set: dto }, { new: true, runValidators: true }).exec();
    if (!report) throw new NotFoundException('Feedback not found.');
    return report;
  }
  async deleteFeedback(id: string) {
    if (!(await this.feedback.findByIdAndDelete(id).exec())) throw new NotFoundException('Feedback not found.');
  }
  async summary(projectId?: string) {
    if (projectId) await this.getProject(projectId);
    const filter = projectId ? { projectId } : {};
    const grouped = await this.feedback.aggregate<{ _id: string; count: number }>([
      { $match: filter }, { $group: { _id: '$status', count: { $sum: 1 } } },
    ]).exec();
    const byStatus = Object.fromEntries(['New', 'Planned', 'In progress', 'Resolved'].map(s => [s, 0]));
    for (const row of grouped) byStatus[row._id] = row.count;
    const byType = await this.feedback.aggregate<{ _id: string; count: number }>([
      { $match: filter }, { $group: { _id: '$type', count: { $sum: 1 } } },
    ]).exec();
    return { total: grouped.reduce((sum, row) => sum + row.count, 0), byStatus,
      byType: Object.fromEntries(['Bug', 'Feature', 'Feedback'].map(t => [t, byType.find(r => r._id === t)?.count || 0])) };
  }
  async *exportCsv(query: FeedbackFilterDto) {
    const projects = await this.projects.find().exec();
    const names = new Map(projects.map(p => [p._id, p.name]));
    yield '\ufeff' + ['Title', 'Project', 'Type', 'Priority', 'Status', 'Source', 'Contact', 'Description', 'Notes', 'Created']
      .map(csvCell).join(',') + '\r\n';
    const cursor = this.feedback.find(this.filter(query)).sort({ createdAt: -1, _id: -1 }).cursor();
    try {
      for await (const row of cursor) {
        yield [row.title, names.get(row.projectId) || row.projectId, row.type, row.priority, row.status,
          row.source, row.contact, row.description, row.notes, row.createdAt.toISOString()].map(csvCell).join(',') + '\r\n';
      }
    } finally { await cursor.close(); }
  }
  // Existing Signal UI contract. REST endpoints above are preferable for large workspaces.
  async workspace() {
    const [projects, reports] = await Promise.all([this.listProjects(), this.feedback.find().sort({ createdAt: -1, _id: -1 }).exec()]);
    return { projects, reports };
  }
}
