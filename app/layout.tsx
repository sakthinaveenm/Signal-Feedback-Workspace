import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Signal | Feedback workspace',description:'One home for feedback across all your projects.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
