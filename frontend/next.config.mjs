/** @type {import("next").NextConfig} */
const config = {
  agentRules: false,
  async rewrites() {
    const backend = process.env.LAB_API_URL || "http://127.0.0.1:8000";
    return [{ source: "/api/:path*", destination: backend + "/:path*" }];
  },
};

export default config;
