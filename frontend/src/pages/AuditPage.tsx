import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [entityFilter, setEntityFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      const data = await api.getAuditLog(entityFilter || undefined);
      setLogs(data);
    } catch (err) {
      console.error('Failed to load audit trail', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [entityFilter]);

  return (
    <div className="flex-1 overflow-auto bg-[#0B0E11] p-6 text-[#E6EBEF] font-mono-num space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#26303A] pb-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-[10px] bg-[#1A2127] border border-[#26303A] text-[#4FB3A5] px-2 py-0.5 rounded-[2px]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4FB3A5]" />
            IMMUTABLE SECURITY AUDIT
          </div>
          <h1 className="text-[18px] font-semibold tracking-wider uppercase text-[#E6EBEF]">
            System & Clinical Override Audit Log
          </h1>
          <p className="text-[12px] text-[#9AA7B2]">
            Comprehensive append-only record of study ingestion, clinical overrides, and radiologist sign-offs.
          </p>
        </div>

        <div>
          <select
            value={entityFilter}
            onChange={e => setEntityFilter(e.target.value)}
            className="bg-[#12171B] border border-[#26303A] text-[#E6EBEF] text-[11px] rounded-[2px] px-3 py-1.5 focus:outline-none focus:border-[#8E9AF0]"
          >
            <option value="">ALL ENTITIES</option>
            <option value="study">STUDY ACTIONS</option>
            <option value="review">CLINICAL REVIEWS & OVERRIDES</option>
            <option value="clinical_context">CONTEXT UPDATES</option>
            <option value="cohort">COHORT LOADS</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="h-44 flex items-center justify-center text-[#66727D] text-[12px]">
          LOADING AUDIT TRAIL...
        </div>
      ) : logs.length === 0 ? (
        <div className="p-8 text-center text-[#66727D] bg-[#12171B] border border-[#26303A] rounded-[2px]">
          No audit records matching current filter.
        </div>
      ) : (
        <div className="bg-[#12171B] border border-[#26303A] rounded-[2px] overflow-hidden">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead className="bg-[#1A2127] border-b border-[#26303A] text-[10px] uppercase text-[#66727D]">
              <tr>
                <th className="py-2.5 px-3">Timestamp (UTC)</th>
                <th className="py-2.5 px-3">Actor</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">Entity</th>
                <th className="py-2.5 px-3">Entity ID</th>
                <th className="py-2.5 px-3">Audit Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#26303A]">
              {logs.map((log: any) => (
                <tr key={log.id} className="hover:bg-[#1A2127]">
                  <td className="py-2 px-3 text-[#9AA7B2] whitespace-nowrap">
                    {log.timestamp ? log.timestamp.replace('T', ' ').slice(0, 19) : 'N/A'}
                  </td>
                  <td className="py-2 px-3 text-[#8E9AF0] font-medium">
                    {log.actor_id?.slice(0, 8) || 'SYSTEM'}
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`px-1.5 py-0.5 rounded-[2px] font-semibold text-[10px] ${
                        log.action.includes('SIGN')
                          ? 'bg-[#4FB3A5]/20 text-[#4FB3A5]'
                          : log.action.includes('OVERRIDE') || log.action.includes('REVIEW')
                          ? 'bg-[#F2A33A]/20 text-[#F2A33A]'
                          : 'bg-[#8E9AF0]/20 text-[#8E9AF0]'
                      }`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="py-2 px-3 uppercase text-[#9AA7B2]">{log.entity}</td>
                  <td className="py-2 px-3 text-[#E6EBEF]">{log.entity_id?.slice(0, 16)}</td>
                  <td className="py-2 px-3 text-[#66727D] max-w-xs truncate">
                    {log.after ? JSON.stringify(log.after) : 'None'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
