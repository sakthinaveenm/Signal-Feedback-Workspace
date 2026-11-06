import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
export const PLATFORMS = ['Web', 'Mobile', 'Web & Mobile', 'Other'] as const;
export const TYPES = ['Bug', 'Feature', 'Feedback'] as const;
export const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;
export const STATUSES = ['New', 'Planned', 'In progress', 'Resolved'] as const;
export const SOURCES = ['Web', 'Mobile', 'Email', 'Other'] as const;
const options = { timestamps: true, versionKey: false as const, toJSON: { transform: (_: unknown, ret: Record<string, unknown>) => {
  ret.id = ret._id; delete ret._id; delete ret.ingestionKeyHash; return ret;
} } };
@Schema(options)
export class Project {
  @Prop({ type: String, default: randomUUID }) _id!: string;
  @Prop({ required: true, trim: true, maxlength: 120 }) name!: string;
  @Prop({ default: '', maxlength: 1000 }) url!: string;
  @Prop({ required: true, enum: PLATFORMS }) platform!: string;
  @Prop({ required: true, select: false }) ingestionKeyHash!: string;
  @Prop({ default: false }) archived!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}
export const ProjectSchema = SchemaFactory.createForClass(Project);
ProjectSchema.index({ createdAt: -1 });
@Schema(options)
export class Feedback {
  @Prop({ type: String, default: randomUUID }) _id!: string;
  @Prop({ type: String, required: true, ref: Project.name }) projectId!: string;
  @Prop({ required: true, trim: true, maxlength: 200 }) title!: string;
  @Prop({ default: '', maxlength: 10000 }) description!: string;
  @Prop({ required: true, enum: TYPES }) type!: string;
  @Prop({ default: 'Medium', enum: PRIORITIES }) priority!: string;
  @Prop({ default: 'New', enum: STATUSES }) status!: string;
  @Prop({ required: true, enum: SOURCES }) source!: string;
  @Prop({ default: '', maxlength: 300 }) contact!: string;
  @Prop({ default: '', maxlength: 10000 }) notes!: string;
  createdAt!: Date;
  updatedAt!: Date;
}
export const FeedbackSchema = SchemaFactory.createForClass(Feedback);
FeedbackSchema.index({ projectId: 1, createdAt: -1, _id: -1 });
FeedbackSchema.index({ status: 1, createdAt: -1 });
