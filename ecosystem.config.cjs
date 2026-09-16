// PM2 process manager configuration for the Trainify school management system.
//
//   pm2 start ecosystem.config.cjs        # start (first time)
//   pm2 reload ecosystem.config.cjs       # zero-downtime restart after a rebuild
//   pm2 restart trainify                  # hard restart
//   pm2 logs trainify                     # tail logs
//   pm2 save && pm2 startup               # survive server reboots
//
// Next.js loads `.env.local` / `.env.production` from `cwd` automatically, so
// DATABASE_URL / TURSO_URL / JWT_SECRET stay out of this file. Override any
// value here only if you are not using an env file.

module.exports = {
  apps: [
    {
      name: "trainify",
      cwd: __dirname,
      // Run the Next.js binary directly (avoids an extra `npm` wrapper process).
      script: "node_modules/next/dist/bin/next",
      args: "start",
      instances: 1,
      // Fork mode is the safe default for Next.js. To scale, set
      // instances: "max" and exec_mode: "cluster" (requires a shared DB and,
      // if you use server actions heavily, sticky sessions at the proxy).
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      kill_timeout: 5000,
      listen_timeout: 10000,
      time: true,
      merge_logs: true,
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
}
