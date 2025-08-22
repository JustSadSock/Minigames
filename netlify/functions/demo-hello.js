// Example Netlify function
// Accessible via /.netlify/functions/demo-hello or /api/demo-hello when using the provided redirect
export default async function handler(req) {
  return new Response(JSON.stringify({ message: 'Hello from Netlify Functions!' }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200
  });
}