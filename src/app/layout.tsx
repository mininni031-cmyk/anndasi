import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'PATTERN LAB | チャート研究室',description:'CSVで始める、ローカルの株式チャート研究室。形状を比較し、自分の判断を検証する。'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ja"><body>{children}</body></html>;}
