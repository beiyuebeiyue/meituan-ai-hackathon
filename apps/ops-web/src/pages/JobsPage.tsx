import { useEffect, useState } from "react";
import { api, JobLog } from "../api/client";

export function JobsPage() {
  const [logs, setLogs] = useState<JobLog[]>([]);

  useEffect(() => {
    void api.getJobLogs().then(setLogs);
  }, []);

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>任务日志</h3>
      </div>
      <div className="list">
        {logs.length === 0 ? <div className="empty">暂无任务日志</div> : null}
        {logs.map((log) => (
          <article className="job-row" key={log.id}>
            <div>
              <strong>{log.job_name}</strong>
              <p>{log.message}</p>
            </div>
            <div className={`status-pill status-${log.status}`}>{log.status}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
