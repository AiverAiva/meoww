FROM docker.io/denoland/deno
WORKDIR /app
COPY . .
RUN deno cache main.ts
CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read", "main.ts"]
