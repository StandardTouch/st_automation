import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { DateInput } from '../../components/common/DateInput';
import { callApi } from '../../api/client';
import { payrollApi } from '../../api/payrollApi';
import { useToast } from '../../components/common/Toast';

const firstOfMonth = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split('T')[0];
};

// Bulk "assign structure to unassigned employees". Three steps:
//   1. pick employees, structure, effective date and a base salary per employee
//   2. server-side dry run (nothing is written) shows the proposed changes and any problems
//   3. explicit confirmation checkbox, then the real write (all-or-nothing on the server)
export function BulkAssignStructureModal({ isOpen, onClose, company, onSuccess, onCreateStructure }) {
  const { addToast } = useToast();
  const [step, setStep] = useState(1);
  const [employees, setEmployees] = useState([]);
  const [structures, setStructures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [structure, setStructure] = useState('');
  const [fromDate, setFromDate] = useState(firstOfMonth());
  const [defaultBase, setDefaultBase] = useState('');
  const [rows, setRows] = useState({}); // name -> { selected, base }
  const [preview, setPreview] = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setStep(1); setPreview(null); setConfirmed(false); setStructure(''); setDefaultBase('');
    setLoading(true);
    Promise.all([
      payrollApi.getUnassignedEmployees(company),
      callApi('st_automation.api.payroll.get_salary_structures', { company }, 'GET'),
    ]).then(([emps, structs]) => {
      const list = emps.data || [];
      setEmployees(list);
      setRows(Object.fromEntries(list.map((e) => [e.name, { selected: false, base: '' }])));
      setStructures(structs.data || []); // backend already returns only active, submitted structures
    }).catch((err) => addToast(err.message || 'Failed to load employees', 'error'))
      .finally(() => setLoading(false));
  }, [isOpen, company]);

  const selected = useMemo(() => employees.filter((e) => rows[e.name]?.selected), [employees, rows]);
  const allSelected = employees.length > 0 && selected.length === employees.length;
  const setRow = (name, patch) => setRows((prev) => ({ ...prev, [name]: { ...prev[name], ...patch } }));
  const applyDefaultBase = () => setRows((prev) => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, v.selected ? { ...v, base: defaultBase } : v])));

  const payload = () => selected.map((e) => ({
    employee: e.name, salary_structure: structure, base: rows[e.name].base, from_date: fromDate,
  }));
  const localProblems = [];
  if (selected.length === 0) localProblems.push('Select at least one employee.');
  if (!structure) localProblems.push('Choose a salary structure.');
  if (!fromDate) localProblems.push('Choose an effective date.');
  if (selected.some((e) => !(Number(rows[e.name].base) > 0))) localProblems.push('Every selected employee needs a base salary greater than zero.');

  const runPreview = async () => {
    setBusy(true);
    try {
      const res = await payrollApi.bulkAssignSalaryStructure(company, payload(), true, false);
      setPreview(res.data);
      setConfirmed(false);
      setStep(2);
    } catch (err) {
      addToast(err.message || 'Preview failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const res = await payrollApi.bulkAssignSalaryStructure(company, payload(), false, true);
      addToast(res.message || 'Salary structures assigned', 'success');
      onSuccess?.();
      onClose();
    } catch (err) {
      addToast(err.message || 'Bulk assignment failed. Nothing was saved.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const nameOf = (id) => employees.find((e) => e.name === id)?.employee_name || id;
  const input = 'w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Assign structure to multiple employees"
      subtitle={step === 1 ? 'Step 1 of 3: choose employees, structure and base salary' : 'Step 2 of 3: review before anything is saved'} maxWidth="max-w-3xl">
      {loading ? <p className="text-sm text-brand-grey">Loading…</p> : step === 1 ? (
        <div className="space-y-4" data-testid="bulk-step-1">
          {structures.length === 0 && (
            <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 space-y-2">
              <p className="font-semibold">No active, submitted salary structure exists yet. Create one first.</p>
              {onCreateStructure && <Button type="button" size="sm" onClick={onCreateStructure}>Create a salary structure</Button>}
            </div>
          )}
          {employees.length === 0 && structures.length > 0 && <p className="text-sm text-brand-grey">Every active employee already has a salary structure.</p>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="bulk-structure" className="block text-sm font-bold mb-1.5">Salary structure</label>
              <select id="bulk-structure" value={structure} onChange={(e) => setStructure(e.target.value)} className={input}>
                <option value="">{structures.length ? 'Select structure…' : 'No structures found'}</option>
                {structures.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="bulk-date" className="block text-sm font-bold mb-1.5">Effective date</label>
              <DateInput id="bulk-date" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={input} />
            </div>
            <div>
              <label htmlFor="bulk-default-base" className="block text-sm font-bold mb-1.5">Same base for selected</label>
              <div className="flex gap-2">
                <input id="bulk-default-base" type="number" min="1" step="0.01" placeholder="e.g. 30000" value={defaultBase} onChange={(e) => setDefaultBase(e.target.value)} className={input} />
                <Button type="button" variant="secondary" size="sm" onClick={applyDefaultBase} disabled={!defaultBase}>Apply</Button>
              </div>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-xl border border-gray-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 dark:bg-slate-800 text-left text-xs font-bold uppercase text-brand-grey">
                <tr>
                  <th className="px-3 py-2 w-10">
                    <input type="checkbox" aria-label="Select all employees" checked={allSelected}
                      onChange={(e) => setRows((prev) => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { ...v, selected: e.target.checked }])))} />
                  </th>
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2 w-44">Base salary (monthly)</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.name} className="border-t border-gray-100 dark:border-slate-700">
                    <td className="px-3 py-2"><input type="checkbox" aria-label={`Select ${e.employee_name}`} checked={!!rows[e.name]?.selected} onChange={(ev) => setRow(e.name, { selected: ev.target.checked })} /></td>
                    <td className="px-3 py-2"><div className="font-semibold">{e.employee_name}</div><div className="text-xs text-brand-grey">{e.name}{e.designation ? ` · ${e.designation}` : ''}</div></td>
                    <td className="px-3 py-2"><input type="number" min="1" step="0.01" aria-label={`Base salary for ${e.employee_name}`} value={rows[e.name]?.base || ''} onChange={(ev) => setRow(e.name, { base: ev.target.value })} className={input} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {localProblems.length > 0 && selected.length > 0 && (
            <ul className="text-xs text-rose-700 list-disc pl-5" data-testid="bulk-local-problems">{localProblems.map((p) => <li key={p}>{p}</li>)}</ul>
          )}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200 dark:border-slate-700">
            <span className="text-sm text-brand-grey">{selected.length} selected</span>
            <div className="flex gap-2">
              <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
              <Button type="button" onClick={runPreview} isLoading={busy} disabled={localProblems.length > 0}>Preview changes</Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4" data-testid="bulk-step-2">
          {preview?.problems?.length > 0 ? (
            <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 space-y-1">
              <p className="font-bold">Fix these before saving. Nothing has been created.</p>
              <ul className="list-disc pl-5">{preview.problems.map((p) => <li key={p.index}>{nameOf(p.employee)}: {p.errors.join(' ')}</li>)}</ul>
            </div>
          ) : (
            <p className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">Preview only. No assignments have been created yet. Proposed changes:</p>
          )}
          <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 dark:bg-slate-800 text-left text-xs font-bold uppercase text-brand-grey"><tr><th className="px-3 py-2">Employee</th><th className="px-3 py-2">Structure</th><th className="px-3 py-2">Base</th><th className="px-3 py-2">From</th></tr></thead>
              <tbody>{(preview?.preview || []).map((r) => (
                <tr key={r.employee} className="border-t border-gray-100 dark:border-slate-700"><td className="px-3 py-2">{nameOf(r.employee)}</td><td className="px-3 py-2">{r.salary_structure}</td><td className="px-3 py-2">{r.base}</td><td className="px-3 py-2">{r.from_date}</td></tr>
              ))}</tbody>
            </table>
          </div>
          {preview?.valid && (
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input type="checkbox" data-testid="bulk-confirm" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1" />
              <span>I confirm creating {preview.preview.length} salary structure assignment{preview.preview.length === 1 ? '' : 's'} from {fromDate}. This changes payroll data.</span>
            </label>
          )}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-slate-700">
            <Button variant="ghost" type="button" onClick={() => setStep(1)}>Back</Button>
            <Button type="button" onClick={confirm} isLoading={busy} disabled={!preview?.valid || !confirmed}>Create assignments</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
