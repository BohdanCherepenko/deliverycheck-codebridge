export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    {
      status: "ok",
      service: "deliverycheck",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
