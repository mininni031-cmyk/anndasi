import type { NextConfig } from 'next';
const nextConfig:NextConfig={reactStrictMode:true,output:process.env.PATTERN_LAB_STATIC_EXPORT==='1'?'export':undefined,allowedDevOrigins:['127.0.0.1'],devIndicators:false};
export default nextConfig;
