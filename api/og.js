export const config = {
  runtime: "edge"
};

function qp(obj){
  return Object.entries(obj)
    .map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}

export default async function handler(req){
  try{
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "Trend";
    const labels = (searchParams.get("labels") || "").split(",").filter(Boolean).slice(-30);
    const values = (searchParams.get("values") || "").split(",").map(Number).filter(x => !Number.isNaN(x)).slice(-30);

    if (labels.length !== values.length || !labels.length){
      return new Response("Bad params", { status: 400, headers: { "content-type": "text/plain" } });
    }

    const cfg = {
      type: "line",
      data: {
        labels,
        datasets: [{ data: values, fill: false, tension: 0.2, pointRadius: 2 }]
      },
      options: {
        plugins: { legend: { display: false }, title: { display: true, text: q } },
        scales: { x: { grid: { display: false } }, y: { suggestedMax: 100 } }
      }
    };

    const url = `https://quickchart.io/chart?${qp({
      c: JSON.stringify(cfg),
      backgroundColor: "#0b0b0b",
      width: 800,
      height: 418,
      format: "png",
      version: "4"
    })}`;

    const r = await fetch(url);
    if (!r.ok) return new Response("Upstream error", { status: 502 });

    const buf = await r.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: {
        "content-type": "image/png",
        "cache-control": "public, max-age=300"
      }
    });
  } catch {
    return new Response("Error", { status: 500 });
  }
}
