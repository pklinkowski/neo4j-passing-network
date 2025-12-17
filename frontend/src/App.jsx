import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";

function PitchGraph({ title, graph, maxCount, height = 340 }) {
  const wrapRef = useRef(null);
  const fgRef = useRef(null);
  const imgRef = useRef(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setBox({ w: r.width, h: r.height });
    });
    ro.observe(el);

    const r = el.getBoundingClientRect();
    setBox({ w: r.width, h: r.height });

    return () => ro.disconnect();
  }, []);

const mappedGraph = useMemo(() => {
  if (!box.w || !box.h) return graph;

  const scale = Math.min(box.w / 120, box.h / 80);

  const nodes = graph.nodes.map(n => {
    if (typeof n.avgX === "number" && typeof n.avgY === "number") {
      return {
        ...n,
        fx: (n.avgX - 60) * scale/1.7 - 300,
        fy: (40 - n.avgY) * scale/1.7 - 180
      };
    }
    return n;
  });

  return { ...graph, nodes };
}, [graph, box]);


  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
  }, [mappedGraph]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 18, fontWeight: 600, textAlign: "center" }}>{title}</div>

      <div
        ref={wrapRef}
        style={{
          position: "relative",
          width: "100%",
          height,
          overflow: "hidden"
        }}
        onWheel={(e) => e.preventDefault()}
      >
        <img
          ref={imgRef}
          src="/pitch.png"
          alt="pitch"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            objectPosition: "center",
            zIndex: 0,
            userSelect: "none",
            pointerEvents: "none"
          }}
        />

        <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
          <ForceGraph2D
            ref={fgRef}
            graphData={mappedGraph}
            backgroundColor="rgba(255,255,255,0)"
            cooldownTicks={0}
            enableZoomPan={false}
            enableNodeDrag={false}
            nodeRelSize={6}
            nodeLabel={n => n.name}
            linkWidth={l => Math.max(1, 6 * (l.count / (maxCount || 1)))}
            linkHoverPrecision={2}
            linkLabel={(l) => `Podania pomiędzy ${l.source.name} a ${l.target.name}: ${l.count}`}
          />
        </div>
      </div>
    </div>
  );
}



function TopPassersTable({ title, rows }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "6px 4px" }}>
              Zawodnik
            </th>
            <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: "6px 4px" }}>
              Celne
            </th>
            <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: "6px 4px" }}>
              Próby
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={3} style={{ padding: 8, color: "#777" }}>
                Brak danych
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.playerId}>
                <td style={{ borderBottom: "1px solid #f0f0f0", padding: "6px 4px" }}>{r.name}</td>
                <td style={{ textAlign: "right", borderBottom: "1px solid #f0f0f0", padding: "6px 4px" }}>
                  {r.completed}
                </td>
                <td style={{ textAlign: "right", borderBottom: "1px solid #f0f0f0", padding: "6px 4px" }}>
                  {r.attempts}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function App() {
  const [matches, setMatches] = useState([]);
  const [matchId, setMatchId] = useState("");

  const [teams, setTeams] = useState([]);
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");

  const [fromMin, setFromMin] = useState(0);
  const [toMin, setToMin] = useState(90);

  const [graphA, setGraphA] = useState({ nodes: [], links: [] });
  const [graphB, setGraphB] = useState({ nodes: [], links: [] });

  const [topA, setTopA] = useState([]);
  const [topB, setTopB] = useState([]);

  const [status, setStatus] = useState("");

  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");

  const teamName = (id) => teams.find((t) => String(t.teamId) === String(id))?.name || "";

  useEffect(() => {
    (async () => {
      setStatus("Loading matches...");
      const r = await fetch("/matches");
      const data = await r.json();
      if (data.ok) {
        setMatches(data.matches);
        if (data.matches.length > 0) setMatchId(data.matches[0].matchId);
        setStatus("");
      } else {
        setStatus("Failed to load matches");
      }
    })();
  }, []);

  useEffect(() => {
    if (!matchId) return;
    (async () => {
      setStatus("Loading teams...");
      const r = await fetch(`/matches/${matchId}/teams`);
      const data = await r.json();
      if (data.ok) {
        setTeams(data.teams);
        const a = data.teams?.[0]?.teamId;
        const b = data.teams?.[1]?.teamId;
        setTeamA(a != null ? String(a) : "");
        setTeamB(b != null ? String(b) : "");
        setStatus("");
      } else {
        setStatus("Failed to load teams");
      }
    })();
  }, [matchId]);

  const buildParams = (teamId) => {
    const p = new URLSearchParams();
    p.set("fromMin", String(fromMin));
    p.set("toMin", String(toMin));
    if (teamId) p.set("teamId", String(teamId));
    return p;
  };

  const fetchTeamGraph = async (teamId) => {
    const params = buildParams(teamId);

    const r = await fetch(`/matches/${matchId}/network?` + params.toString());
    const data = await r.json();
    if (!data.ok) throw new Error(data.error || "network failed");

    const pr = await fetch(`/matches/${matchId}/positions?` + params.toString());
    const posData = await pr.json();

    let posMap = new Map();
    if (posData.ok) {
      posMap = new Map(
        posData.positions.map((p) => [p.playerId, { avgX: Number(p.avgX), avgY: Number(p.avgY) }])
      );
    }

    const nodes = data.nodes.map((n) => {
      const pos = posMap.get(n.id);
      return { id: n.id, name: n.name, ...(pos ? { avgX: pos.avgX, avgY: pos.avgY } : {}) };
    });


    const links = data.links.map((l) => ({ source: l.source, target: l.target, count: l.count }));

    return { nodes, links };
  };

  const fetchTopPassers = async (teamId) => {
    const params = buildParams(teamId);
    params.set("limit", "10");
    const r = await fetch(`/matches/${matchId}/top-passers?` + params.toString());
    const data = await r.json();
    if (!data.ok) throw new Error(data.error || "top-passers failed");
    return data.players;
  };

  const reloadAll = async () => {
    if (!matchId || !teamA || !teamB) return;
    try {
      setStatus("Loading graphs & tables...");

      const [ga, gb, ta, tb] = await Promise.all([
        fetchTeamGraph(teamA),
        fetchTeamGraph(teamB),
        fetchTopPassers(teamA),
        fetchTopPassers(teamB)
      ]);

      setGraphA(ga);
      setGraphB(gb);
      setTopA(ta);
      setTopB(tb);

      setStatus("");
    } catch (e) {
      setStatus("Error: " + e.message);
    }
  };

  useEffect(() => {
    reloadAll();
  }, [matchId, teamA, teamB, fromMin, toMin]);

  const maxA = useMemo(() => graphA.links.reduce((m, l) => Math.max(m, l.count || 1), 1), [graphA]);
  const maxB = useMemo(() => graphB.links.reduce((m, l) => Math.max(m, l.count || 1), 1), [graphB]);

  const uploadMatch = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadMsg("Uploading...");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const r = await fetch("/matches/import", { method: "POST", body: formData });
      const data = await r.json();

      if (data.ok) {
        setUploadMsg(`Imported match ${data.matchId} (${data.passesImported} passes)`);
        const mr = await fetch("/matches");
        const md = await mr.json();
        if (md.ok) {
          setMatches(md.matches);
          setMatchId(data.matchId);
        }
      } else {
        setUploadMsg("Import failed: " + data.error);
      }
    } catch (e) {
      setUploadMsg("Import error: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "360px 1fr 420px",
        height: "100vh",
        overflow: "hidden"
      }}
    >
      <div style={{ padding: 16, borderRight: "1px solid #ddd", overflowY: "auto" }}>
        <h2>Passing Network</h2>

        <div style={{ marginBottom: 16 }}>
          <label>Import meczu (StatsBomb JSON)</label>
          <br />
          <input
            type="file"
            accept=".json"
            disabled={uploading}
            onChange={(e) => uploadMatch(e.target.files?.[0])}
            style={{ width: "100%" }}
          />
          {uploadMsg && <div style={{ marginTop: 8, fontSize: 12 }}>{uploadMsg}</div>}
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Mecz</label>
          <br />
          <select value={matchId} onChange={(e) => setMatchId(e.target.value)} style={{ width: "100%" }}>
            {matches.map((m) => (
              <option key={m.matchId} value={m.matchId}>
                {m.matchId}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Drużyna 1</label>
          <br />
          <select value={teamA} onChange={(e) => setTeamA(e.target.value)} style={{ width: "100%" }}>
            {teams.map((t) => (
              <option key={t.teamId} value={String(t.teamId)}>
                {t.name} ({t.teamId})
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Drużyna 2</label>
          <br />
          <select value={teamB} onChange={(e) => setTeamB(e.target.value)} style={{ width: "100%" }}>
            {teams.map((t) => (
              <option key={t.teamId} value={String(t.teamId)}>
                {t.name} ({t.teamId})
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Minuta od</label>
          <br />
          <input
            type="number"
            value={fromMin}
            min={0}
            max={120}
            onChange={(e) => setFromMin(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Minuta do</label>
          <br />
          <input
            type="number"
            value={toMin}
            min={0}
            max={120}
            onChange={(e) => setToMin(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>

        <button onClick={reloadAll} style={{ width: "100%", padding: 10 }}>
          Odśwież
        </button>

        <p style={{ marginTop: 12, color: "#555" }}>{status}</p>
      </div>

      <div style={{ padding: 16, overflowY: "auto", display: "flex", justifyContent: "center" }}>
        <div style={{ width: "min(900px, 100%)", display: "grid", gridTemplateRows: "auto auto", gap: 16 }}>
          <PitchGraph title={teamName(teamA) || "Drużyna 1"} graph={graphA} maxCount={maxA} height={340} />
          <PitchGraph title={teamName(teamB) || "Drużyna 2"} graph={graphB} maxCount={maxB} height={340} />
        </div>
      </div>

      <div style={{ padding: 16, borderLeft: "1px solid #ddd", overflowY: "auto" }}>
        <TopPassersTable title={`${teamName(teamA) || "Drużyna 1"} – top podających`} rows={topA} />
        <TopPassersTable title={`${teamName(teamB) || "Drużyna 2"} – top podających`} rows={topB} />
        <div style={{ fontSize: 12, color: "#777" }}>
        </div>
      </div>
    </div>
  );
}
