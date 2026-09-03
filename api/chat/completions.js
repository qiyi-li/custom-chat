import handler from '../[...path].js';
export { config } from '../[...path].js';

// Vercel's catch-all route serves /api/models but does not reliably match this
// two-segment POST route. Keep an explicit entrypoint for chat completions.
export default handler;
