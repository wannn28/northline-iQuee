module.exports = {
  apps: [
    {
      name: 'northline',
      cwd: '/var/www/northline-supply',
      script: 'server/dist/index.cjs',
      interpreter: '/root/.nvm/versions/node/v20.19.0/bin/node',
      env: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: '3018',
        ADMIN_PASSWORD: 'northline-demo',
      },
    },
  ],
}
