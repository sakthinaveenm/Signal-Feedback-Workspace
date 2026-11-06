import { z } from 'zod';
import { getDb } from '../../../db';
import { projects, reports } from '../../../db/schema';
import { eq } from 'drizzle-orm';
export async function GET(){const db=getDb();return Response.json({projects:await db.select().from(projects),reports:await db.select().from(reports)});}
export async function POST(request:Request){try{const b=z.record(z.string(),z.string()).parse(await request.json());const db=getDb();
if(b.action==='project'){if(typeof b.name!=='string'||!b.name.trim()||b.name.length>120)throw Error('Enter a project name (up to 120 characters).'); if(!['Web','Mobile','Web & Mobile','Other'].includes(b.platform))throw Error('Choose a platform.'); await db.insert(projects).values({id:crypto.randomUUID(),name:b.name.trim(),url:String(b.url||'').slice(0,1000),platform:b.platform,createdAt:new Date().toISOString()});}
else if(b.action==='report'){if(typeof b.title!=='string'||!b.title.trim()||b.title.length>200)throw Error('Enter a title (up to 200 characters).');if(!(await db.select().from(projects).where(eq(projects.id,b.projectId))).length)throw Error('Choose a project.'); if(!['Bug','Feature','Feedback'].includes(b.type)||!['Low','Medium','High','Critical'].includes(b.priority)||!['Web','Mobile','Email','Other'].includes(b.source))throw Error('Invalid report options.');await db.insert(reports).values({id:crypto.randomUUID(),projectId:b.projectId,title:b.title.trim(),description:String(b.description||'').slice(0,10000),type:b.type,priority:b.priority,status:'New',source:b.source,contact:String(b.contact||'').slice(0,300),notes:'',createdAt:new Date().toISOString()});}
else if(b.action==='update'){if(!['New','Planned','In progress','Resolved'].includes(b.status)||!['Low','Medium','High','Critical'].includes(b.priority))throw Error('Invalid status or priority.');await db.update(reports).set({status:b.status,priority:b.priority,notes:String(b.notes||'').slice(0,10000)}).where(eq(reports.id,b.id));}
else if(b.action==='delete'){await db.delete(reports).where(eq(reports.id,b.id));}
else throw Error('Unknown action');return Response.json({ok:true});}catch(e){return Response.json({error:e instanceof Error?e.message:'Unable to save'},{status:400});}}

