import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Editor from '@monaco-editor/react';
import './styles.css';

const STORY_FILES = import.meta.glob('./projects/*/story.json', { eager: true, import: 'default' });
const TASK_FILES = import.meta.glob('./projects/*/objectives.json', { eager: true, import: 'default' });
const REVIEW_FILES = import.meta.glob('./projects/*/review.json', { eager: true, import: 'default' });
const REPORT_FILES = import.meta.glob('./projects/*/investigation-report.json', { eager: true, import: 'default' });
const DATA_FILES = import.meta.glob('./projects/*/datasets/*.csv', { eager: true, query: '?raw', import: 'default' });
const STORAGE_KEY = 'baa-progress-v2';
const PYODIDE_INDEX_URL = 'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/';
const EMPTY_PROGRESS = { xp: 0, completedMissions: [], currentMission: null, code: {}, achievements: [], taskCompletion: {}, reviewAttempts: {} };

/** Expands compact authored seed evidence into realistic-sized client exports for the prototype. */
function expandEvidence(content, targetRows = 55) {
  const [header, ...seed] = content.trim().split('\n');
  if (seed.length >= targetRows) return content;
  const rows = [...seed];
  for (let index = seed.length; index < targetRows; index += 1) {
    const source = seed[index % seed.length].split(',');
    // Preserve every quality issue and business pattern in the seed while giving
    // each exported record a believable unique identifier and varied measures.
    source[0] = `${source[0].replace(/\d+$/, '')}${String(index + 1).padStart(3, '0')}`;
    source.forEach((value, column) => {
      if (column > 0 && /^\d+(\.\d+)?$/.test(value)) source[column] = String(Math.round(Number(value) * (0.82 + (index % 9) * 0.045)));
    });
    rows.push(source.join(','));
  }
  return [header, ...rows].join('\n');
}

/** Discovers mission folders at build time. Add a folder with story.json, tasks.json and datasets to extend the game. */
function loadMissions() {
  return Object.entries(STORY_FILES).map(([path, story]) => {
    const folder = path.split('/')[2];
    const tasks = TASK_FILES[`./projects/${folder}/objectives.json`] || [];
    const review = REVIEW_FILES[`./projects/${folder}/review.json`] || {};
    const investigationReport = REPORT_FILES[`./projects/${folder}/investigation-report.json`] || {};
    const datasets = Object.entries(DATA_FILES).filter(([file]) => file.includes(`./projects/${folder}/datasets/`)).map(([file, rawContent]) => { const content = expandEvidence(rawContent); return[...]
    return { ...story, ...review, investigationReport, tasks, datasets, folder };
  }).sort((a, b) => a.order - b.order);
}
const MISSIONS = loadMissions();
const readProgress = () => { try { return { ...EMPTY_PROGRESS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; } catch { return EMPTY_PROGRESS; } };
const rankFor = xp => xp >= 1600 ? 'Lead Analyst' : xp >= 900 ? 'Business Analyst' : xp >= 400 ? 'Associate Analyst' : 'Intern Analyst';
const save = value => localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
const download = file => { const url = URL.createObjectURL(new Blob([file.content], { type: 'text/csv' })); const link = document.createElement('a'); link.href = url; link.download = file.name; li[...]

function App() {
  const [page, setPage] = useState('dashboard');
  const [progress, setProgress] = useState(readProgress);
  const [selected, setSelected] = useState(null);
  const persist = updater => setProgress(old => { const next = updater(old); save(next); return next; });
  const openMission = mission => { setSelected(mission); setPage('mission'); };
  return page === 'mission' ? <MissionScreen mission={selected} progress={progress} persist={persist} onExit={() => setPage('dashboard')} /> : <Dashboard missions={MISSIONS} progress={progress} on[...]
}

function Dashboard({ missions, progress, onOpen }) {
  const completed = progress.completedMissions.length;
  const unlocked = Math.min(completed + 1, missions.length);
  const current = missions.find(m => m.id === progress.currentMission && !progress.completedMissions.includes(m.id)) || missions[completed] || missions[0];
  const skills = missions.filter(m => progress.completedMissions.includes(m.id)).flatMap(m => m.expectedConcepts);
  return <main className="home-shell dashboard-shell"><div className="ambient orb-a" /><div className="ambient orb-b" /><nav className="top-nav"><div className="brand"><span className="brand-mark"[...]
}
function Stat({ label, value }) { return <div><span>{label}</span><strong>{value}</strong></div>; }

function MissionScreen({ mission, progress, persist, onExit }) {
  const [code, setCode] = useState(progress.code?.[mission.id] || mission.starterCode);
  const [output, setOutput] = useState('Run your analysis to see results here.');
  const [running, setRunning] = useState(false); const [activeFile, setActiveFile] = useState(mission.datasets[0]);
  const [completeTasks, setCompleteTasks] = useState(progress.taskCompletion?.[mission.id] || []); const [hint, setHint] = useState(0); const [handbook, setHandbook] = useState(false); const [read[...]
  useEffect(() => { persist(p => ({ ...p, currentMission: mission.id, code: { ...p.code, [mission.id]: code } })); }, [code, mission.id]);
  useEffect(() => { persist(p => ({ ...p, taskCompletion: { ...p.taskCompletion, [mission.id]: completeTasks } })); }, [completeTasks, mission.id]);
  useEffect(() => { if (showCompletion && !approvalGranted) { setShowCompletion(false); setReportOpen(true); } }, [showCompletion, approvalGranted]);
  const passedTasks = (source, text) => mission.tasks.filter(task => new RegExp(task.matcher, 'i').test(source) || (task.outputMatcher && new RegExp(task.outputMatcher, 'i').test(text))).map(task [...]
  const run = async () => { setRunning(true); setOutput('Preparing browser analysis workspace…'); try { if (!pyodide.current) { const { loadPyodide } = await import(/* @vite-ignore */ `${PYODIDE[...]
  const finish = () => persist(p => p.completedMissions.includes(mission.id) ? p : ({ ...p, xp: p.xp + 100 + completeTasks.length * 25, completedMissions: [...p.completedMissions, mission.id], ach[...]
  if (reportOpen) return <InvestigationReport mission={mission} progress={progress} persist={persist} onReturn={() => setReportOpen(false)} onApproved={() => { setApprovalGranted(true); setReportO[...]
  return <main className="mission-shell"><header className="mission-header"><button className="back" onClick={onExit}>← Dashboard</button><div><span className="crumb">CASE {String(mission.order)[...]
}
const indent = code => code.split('\n').map(line => ` ${line}`).join('\n');
function PanelTitle({ icon, label }) { return <div className="panel-title"><span>{icon}</span>{label}</div>; }
function Handbook({ entries, onClose }) { return <div className="modal-backdrop handbook-backdrop" onMouseDown={onClose}><section className="handbook glass" onMouseDown={e => e.stopPropagation()}>[...]
function Completion({ mission, alreadyDone, onFinish, onExit }) { const [reference, setReference] = useState(false); const earned = 100 + mission.tasks.length * 25; return <div className="modal-ba[...]
function answersMatch(answer, correctAnswer, type) {
  if (String(type).toLowerCase() === 'checkbox') return Array.isArray(answer) && answer.length === correctAnswer.length && answer.every(value => correctAnswer.includes(value));
  return String(answer || '').trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();
}
function InvestigationReport({ mission, progress, persist, onReturn, onApproved }) {
  const report = mission.investigationReport;
  const totalReviews = report.reviewAttempts || 3;
  const [answers, setAnswers] = useState({});
  const [remaining, setRemaining] = useState(progress.reviewAttempts?.[mission.id] ?? totalReviews);
  const [review, setReview] = useState(null);
  const [reveal, setReveal] = useState(false);
  const setAnswer = (id, value) => setAnswers(current => ({ ...current, [id]: value }));
  const submit = () => {
    if (!remaining) return;
    const approved = report.questions.every(question => answersMatch(answers[question.id], question.correctAnswer, question.type));
    if (approved) { setReview('approved'); return; }
    const nextRemaining = remaining - 1;
    setRemaining(nextRemaining);
    persist(current => ({ ...current, reviewAttempts: { ...current.reviewAttempts, [mission.id]: nextRemaining } }));
    setReview('needs-evidence');
  };
  const renderQuestion = question => {
    const value = answers[question.id];
    const type = String(question.type).toLowerCase();
    if (type === 'dropdown') return <select value={value || ''} onChange={event => setAnswer(question.id, event.target.value)}><option value="">Select an answer</option>{question.options.map(opti[...]
    if (type === 'text') return <textarea value={value || ''} onChange={event => setAnswer(question.id, event.target.value)} placeholder="Write your conclusion" />;
    return <div className="report-options">{question.options.map(option => <label key={option}><input type={type === 'checkbox' ? 'checkbox' : 'radio'} name={question.id} checked={type === 'check[...]
  };
  return <main className="mission-shell report-shell"><header className="mission-header"><button className="back" onClick={onReturn}>Back to Investigation</button><div><span className="crumb">CAS[...]
}
function ReviewDialog({ title, message, primary, onPrimary, onClose }) { return <div className="modal-backdrop"><section className="completion glass"><div className="success-seal">{title === 'Man[...]

// microsoft_clarity - injected as JS (no raw <script> tags)
(function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "xsstqf2gy8");

createRoot(document.getElementById('root')).render(<App />);
