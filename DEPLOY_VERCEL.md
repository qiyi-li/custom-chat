# Deploy to Vercel

This repository is based on [NextChat](https://github.com/ChatGPTNextWeb/NextChat), a complete chat UI with streaming, Markdown, code highlighting, local conversation history, prompt management, and model settings.

## Deploy

1. Import this GitHub repository in [Vercel](https://vercel.com/new).
2. In **Settings -> Environment Variables**, add these Production variables:

   ```text
   OPENAI_API_KEY=your-new-air-router-key
   BASE_URL=https://www.air-router.com/v1
   HIDE_USER_API_KEY=1
   CODE=a-long-private-password
   ```

3. Redeploy the project after saving the variables.
4. Open the `*.vercel.app` URL and enter the value of `CODE` when prompted.

`OPENAI_API_KEY` is used only by the Vercel server-side API route. Never give it a `NEXT_PUBLIC_` prefix and do not put it in GitHub or browser storage.

The app also accepts the legacy names `API_KEY` and `TARGET_BASE_URL`, but `OPENAI_API_KEY` and `BASE_URL` are the recommended names.

## Models

The application requests the model list through its server-side OpenAI-compatible proxy. Pick a returned model from Settings, or add the model ID supplied by Air Router if it is not listed.
