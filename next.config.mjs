/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['agora-agent-uikit', 'agora-agent-client-toolkit'],
  async headers() {
    return [
      {
        // Allow /embed to be loaded inside an iframe from any origin
        source: '/embed',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { key: 'Content-Security-Policy', value: "frame-ancestors *" },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
    ];
  },
};

export default nextConfig;
