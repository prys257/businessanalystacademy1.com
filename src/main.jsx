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
    const datasets = Object.entries(DATA_FILES).filter(([file]) => file.includes(`./projects/${folder}/datasets/`)).map(([file, rawContent]) => { const content = expandEvidence(rawContent); return { name: file.split('/').pop(), content, rows: Math.max(0, content.trim().split('\n').length - 1) }; });
    return { ...story, ...review, investigationReport, tasks, datasets, folder };
  }).sort((a, b) => a.order - b.order);
}
const MISSIONS = loadMissions();
const readProgress = () => { try { return { ...EMPTY_PROGRESS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; } catch { return EMPTY_PROGRESS; } };
const rankFor = xp => xp >= 1600 ? 'Lead Analyst' : xp >= 900 ? 'Business Analyst' : xp >= 400 ? 'Associate Analyst' : 'Intern Analyst';
const save = value => localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
const download = file => { const url = URL.createObjectURL(new Blob([file.content], { type: 'text/csv' })); const link = document.createElement('a'); link.href = url; link.download = file.name; link.click(); URL.revokeObjectURL(url); };

function App() {
  const [page, setPage] = useState('dashboard');
  const [progress, setProgress] = useState(readProgress);
  const [selected, setSelected] = useState(null);
  const persist = updater => setProgress(old => { const next = updater(old); save(next); return next; });
  const openMission = mission => { setSelected(mission); setPage('mission'); };
  return page === 'mission' ? <MissionScreen mission={selected} progress={progress} persist={persist} onExit={() => setPage('dashboard')} /> : <Dashboard missions={MISSIONS} progress={progress} onOpen={openMission} />;
}

function Dashboard({ missions, progress, onOpen }) {
  const completed = progress.completedMissions.length;
  const unlocked = Math.min(completed + 1, missions.length);
  const current = missions.find(m => m.id === progress.currentMission && !progress.completedMissions.includes(m.id)) || missions[completed] || missions[0];
  const skills = missions.filter(m => progress.completedMissions.includes(m.id)).flatMap(m => m.expectedConcepts);
  return <main className="home-shell dashboard-shell"><div className="ambient orb-a" /><div className="ambient orb-b" /><nav className="top-nav"><div className="brand"><span className="brand-mark">BA</span> BUSINESS ANALYST ACADEMY</div><div className="xp-chip">✦ {progress.xp} XP</div></nav><section className="dashboard-head"><div><div className="eyebrow">CONSULTING LEARNING DASHBOARD</div><h1>Welcome back,<br /><em>{rankFor(progress.xp)}</em></h1><p>Build Python fluency by closing real business cases.</p><button className="button primary" onClick={() => onOpen(current)}>Continue investigation <span>→</span></button></div><div className="stats-card glass"><Stat label="CURRENT RANK" value={rankFor(progress.xp)} /><Stat label="COMPLETED MISSIONS" value={`${completed} / ${missions.length}`} /><Stat label="COMPLETION" value={`${Math.round(completed / missions.length * 100)}%`} /><Stat label="UNLOCKED" value={`${unlocked} cases`} /></div></section><section className="learner-strip glass"><div><span>PYTHON SKILLS LEARNED</span><strong>{skills.length ? [...new Set(skills)].join(' · ') : 'Complete a case to record your first skill.'}</strong></div><div><span>RECENT ACHIEVEMENT</span><strong>{progress.achievements.at(-1) || 'Your first client case is ready.'}</strong></div></section><section className="mission-board"><div className="board-title"><div><span>INVESTIGATION ROADMAP</span><h2>Client cases</h2></div><small>{progress.xp} XP confirmed</small></div><div className="mission-grid">{missions.map((mission, index) => { const done = progress.completedMissions.includes(mission.id); const available = index < unlocked; return <button className={`mission-card glass ${done ? 'mission-done' : ''} ${!available ? 'locked' : ''}`} key={mission.id} disabled={!available} onClick={() => onOpen(mission)}><div><span>CASE {String(mission.order).padStart(2, '0')}</span><b>{done ? '✓ COMPLETE' : available ? 'OPEN CASE' : 'LOCKED'}</b></div><h3>{mission.title}</h3><p>{mission.company}</p><small>{mission.expectedConcepts.join(' · ')}</small></button>; })}</div></section></main>;
}
function Stat({ label, value }) { return <div><span>{label}</span><strong>{value}</strong></div>; }

function MissionScreen({ mission, progress, persist, onExit }) {
  const [code, setCode] = useState(progress.code?.[mission.id] || mission.starterCode);
  const [output, setOutput] = useState('Run your analysis to see results here.');
  const [running, setRunning] = useState(false); const [activeFile, setActiveFile] = useState(mission.datasets[0]);
  const [completeTasks, setCompleteTasks] = useState(progress.taskCompletion?.[mission.id] || []); const [hint, setHint] = useState(0); const [handbook, setHandbook] = useState(false); const [ready, setReady] = useState((progress.taskCompletion?.[mission.id] || []).length === mission.tasks.length); const [showCompletion, setShowCompletion] = useState(false); const [reportOpen, setReportOpen] = useState(false); const [approvalGranted, setApprovalGranted] = useState(false); const pyodide = useRef(null);
  useEffect(() => { persist(p => ({ ...p, currentMission: mission.id, code: { ...p.code, [mission.id]: code } })); }, [code, mission.id]);
  useEffect(() => { persist(p => ({ ...p, taskCompletion: { ...p.taskCompletion, [mission.id]: completeTasks } })); }, [completeTasks, mission.id]);
  useEffect(() => { if (showCompletion && !approvalGranted) { setShowCompletion(false); setReportOpen(true); } }, [showCompletion, approvalGranted]);
  const passedTasks = (source, text) => mission.tasks.filter(task => new RegExp(task.matcher, 'i').test(source) || (task.outputMatcher && new RegExp(task.outputMatcher, 'i').test(text))).map(task => task.id);
  const run = async () => { setRunning(true); setOutput('Preparing browser analysis workspace…'); try { if (!pyodide.current) { const { loadPyodide } = await import(/* @vite-ignore */ `${PYODIDE_INDEX_URL}pyodide.mjs`); pyodide.current = await loadPyodide({ indexURL: PYODIDE_INDEX_URL }); } const runtime = pyodide.current; await runtime.loadPackage(mission.packages || ['pandas']); mission.datasets.forEach(file => runtime.FS.writeFile(file.name, file.content)); const result = await runtime.runPythonAsync(`import sys, io\n_capture = io.StringIO()\nsys.stdout = _capture\nsys.stderr = _capture\ntry:\n${indent(code)}\nexcept Exception as error:\n print(f'Error: {error}')\nfinally:\n sys.stdout = sys.__stdout__\n sys.stderr = sys.__stderr__\n_capture.getvalue()`); const text = String(result || 'Analysis finished with no printed output.'); const passed = passedTasks(code, text); setOutput(text); setCompleteTasks(passed); setReady(passed.length === mission.tasks.length); } catch (error) { setOutput(`Environment error: ${error.message}`); } finally { setRunning(false); } };
  const finish = () => persist(p => p.completedMissions.includes(mission.id) ? p : ({ ...p, xp: p.xp + 100 + completeTasks.length * 25, completedMissions: [...p.completedMissions, mission.id], achievements: [...p.achievements, `${mission.title} closed`] }));
  if (reportOpen) return <InvestigationReport mission={mission} progress={progress} persist={persist} onReturn={() => setReportOpen(false)} onApproved={() => { setApprovalGranted(true); setReportOpen(false); setShowCompletion(true); }} />;
  return <main className="mission-shell"><header className="mission-header"><button className="back" onClick={onExit}>← Dashboard</button><div><span className="crumb">CASE {String(mission.order).padStart(2, '0')} / {mission.company.toUpperCase()}</span><strong>{mission.title}</strong></div><div className="xp-chip">✦ {progress.xp} XP</div></header><div className="workspace"><aside className="left-panel"><PanelTitle icon="▣" label="MISSION BRIEF" /><h2>{mission.storyline.headline}</h2><p className="brief-lead">{mission.storyline.summary}</p><div className="assignment"><span>YOUR ASSIGNMENT</span><p>{mission.objectives[0]}</p></div><PanelTitle icon="▤" label="EVIDENCE FOLDER" /><div className="file-list">{mission.datasets.map(file => <button key={file.name} className={`file-item ${activeFile?.name === file.name ? 'selected' : ''}`} onClick={() => setActiveFile(file)}><span className="file-icon">CSV</span><span>{file.name}<small>{file.rows} records</small></span><b onClick={event => { event.stopPropagation(); download(file); }}>↓</b></button>)}</div>{activeFile && <div className="csv-preview"><div><span>PREVIEW</span><strong>{activeFile.name}</strong></div><pre>{activeFile.content.split('\n').slice(0, 5).join('\n')}</pre></div>}</aside><section className="editor-panel glass"><div className="editor-top"><div><span className="python-dot">●</span> analysis.py</div><span>PYTHON 3</span></div><Editor height="48vh" defaultLanguage="python" value={code} onChange={v => setCode(v || '')} theme="vs-dark" options={{ minimap: { enabled: false }, fontSize: 14, padding: { top: 16 }, scrollBeyondLastLine: false }} /><div className="editor-actions"><button className="button run" onClick={run} disabled={running}>{running ? 'Running…' : '▶ Run Code'}</button><button className="reset" onClick={() => { setCode(mission.starterCode); setCompleteTasks([]); setReady(false); }}>↻ Reset</button></div><div className="console"><div className="console-title"><span>OUTPUT CONSOLE</span><i className={running ? 'pulse' : ''} /></div><pre>{output}</pre><div className="console-continue"><span>{ready ? 'Checklist complete — review your evidence before closing the case.' : 'Complete every objective to unlock case completion.'}</span><button className="button continue-button" disabled={!ready} onClick={() => setShowCompletion(true)}>Continue →</button></div></div></section><aside className="right-panel"><PanelTitle icon="✦" label="SENIOR ANALYST MENTOR" /><div className="mentor glass"><div className="mentor-avatar">SA</div><h3>Case Coach</h3><p>Strong analysts validate each assumption against the evidence. You are on the right track.</p><div className="hint"><span>COACHING NOTE {hint + 1} / {mission.hints.length}</span><strong>{mission.hints[hint]}</strong></div><button className="hint-button" disabled={hint === mission.hints.length - 1} onClick={() => setHint(i => i + 1)}>{hint === mission.hints.length - 1 ? 'All notes revealed' : 'Reveal next note →'}</button><button className="handbook-button" onClick={() => setHandbook(true)}>▤ Open Analyst Handbook</button></div><div className="objective"><span>BUSINESS OUTCOME</span><p>{mission.businessInsight}</p></div></aside></div><section className="progress-bar"><div className="progress-heading"><div><span>MISSION PROGRESS</span><strong>Evidence analysis checklist</strong></div><span>{completeTasks.length} / {mission.tasks.length} COMPLETE</span></div><div className="task-grid">{mission.tasks.map((task, index) => <div key={task.id} className={`task ${completeTasks.includes(task.id) ? 'done' : ''}`}><b>{completeTasks.includes(task.id) ? '✓' : index + 1}</b><div><strong>{task.label}</strong><small>+25 XP</small></div></div>)}</div></section>{handbook && <Handbook entries={mission.handbook} onClose={() => setHandbook(false)} />}{showCompletion && <Completion mission={mission} alreadyDone={progress.completedMissions.includes(mission.id)} onFinish={finish} onExit={onExit} />}</main>;
}
const indent = code => code.split('\n').map(line => ` ${line}`).join('\n');
function PanelTitle({ icon, label }) { return <div className="panel-title"><span>{icon}</span>{label}</div>; }
function Handbook({ entries, onClose }) { return <div className="modal-backdrop handbook-backdrop" onMouseDown={onClose}><section className="handbook glass" onMouseDown={e => e.stopPropagation()}><header><div><span>ANALYST HANDBOOK</span><h2>Useful tools for this investigation</h2><p>These reference cards are deliberately mixed. Choose the technique that supports your reasoning—there is no prescribed solution path.</p></div><button className="close-button" onClick={onClose}>×</button></header><div className="handbook-grid">{entries.map((entry, i) => <article className="handbook-card" key={entry.heading}><div className="card-number">{String(i + 1).padStart(2, '0')}</div><h3>{entry.heading}</h3><label>WHAT IT DOES</label><p>{entry.whatItDoes}</p><label>EXAMPLE</label><pre>{entry.example}</pre><label>USE CASE</label><p>{entry.useCase}</p></article>)}</div></section></div>; }
function Completion({ mission, alreadyDone, onFinish, onExit }) { const [reference, setReference] = useState(false); const earned = 100 + mission.tasks.length * 25; return <div className="modal-backdrop"><div className="completion review-card glass"><div className="success-seal">✓</div><span>PROFESSIONAL INVESTIGATION REVIEW</span><h2>{mission.title}</h2><div className="review-section"><small>BUSINESS QUESTION</small><p>{mission.businessQuestion}</p><small>INVESTIGATION STRATEGY</small><ol>{(mission.strategy || []).map(step => <li key={step}>{step}</li>)}</ol><small>BUSINESS INSIGHT</small><p>{mission.businessInsight}</p><small>BUSINESS RECOMMENDATION</small><p>{mission.recommendation}</p></div><div className="completion-stats"><div><small>XP EARNED</small><strong>+{alreadyDone ? 0 : earned} XP</strong></div><div><small>PRACTICED</small><strong>{mission.expectedConcepts.join(', ')}</strong></div></div><button className="reference-button" onClick={() => setReference(!reference)}>{reference ? 'Hide Reference Implementation' : 'View Reference Implementation'}</button>{reference && <pre className="reference-code">{mission.referenceImplementation}</pre>}<button className="button primary" onClick={() => { onFinish(); onExit(); }}>Return to dashboard</button></div></div>; }
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
    if (type === 'dropdown') return <select value={value || ''} onChange={event => setAnswer(question.id, event.target.value)}><option value="">Select an answer</option>{question.options.map(option => <option key={option} value={option}>{option}</option>)}</select>;
    if (type === 'text') return <textarea value={value || ''} onChange={event => setAnswer(question.id, event.target.value)} placeholder="Write your conclusion" />;
    return <div className="report-options">{question.options.map(option => <label key={option}><input type={type === 'checkbox' ? 'checkbox' : 'radio'} name={question.id} checked={type === 'checkbox' ? (value || []).includes(option) : value === option} onChange={() => type === 'checkbox' ? setAnswer(question.id, (value || []).includes(option) ? value.filter(item => item !== option) : [...(value || []), option]) : setAnswer(question.id, option)} />{option}</label>)}</div>;
  };
  return <main className="mission-shell report-shell"><header className="mission-header"><button className="back" onClick={onReturn}>Back to Investigation</button><div><span className="crumb">CASE {String(mission.order).padStart(2, '0')} / {mission.company.toUpperCase()}</span><strong>{mission.title}</strong></div><div className="xp-chip">XP {progress.xp}</div></header><section className="report-page glass"><div className="report-heading"><span>FINAL MANAGER REVIEW</span><h1>Investigation Report</h1><p>{report.introduction}</p></div><div className="review-counter"><span>MANAGER REVIEWS REMAINING</span><strong>{remaining} / {totalReviews}</strong></div><div className="report-questions">{report.questions.map((question, index) => <section className="report-question" key={question.id}><span>QUESTION {String(index + 1).padStart(2, '0')}</span><h2>{question.question}</h2>{renderQuestion(question)}</section>)}</div>{remaining === 0 && <button className="reference-button" onClick={() => setReveal(value => !value)}>{reveal ? 'Hide Investigation Report' : 'Reveal Investigation Report'}</button>}{reveal && <div className="revealed-report">{report.revealReport.map(section => <div key={section.heading}><small>{section.heading}</small><p>{section.content}</p></div>)}</div>}<div className="report-actions"><button className="reset" onClick={onReturn}>Return to Investigation</button><button className="button continue-button" disabled={!remaining} onClick={submit}>Submit for Manager Review</button></div></section>{review === 'needs-evidence' && <ReviewDialog title="Investigation Needs More Evidence" message="Your conclusions are not fully supported by the evidence collected during this investigation. Review your findings and submit another report." primary="Return to Investigation" onPrimary={onReturn} onClose={() => setReview(null)} />}{review === 'approved' && <ReviewDialog title="Manager Review" message={report.approvalMessage} primary="Continue" onPrimary={onApproved} />}</main>;
}
function ReviewDialog({ title, message, primary, onPrimary, onClose }) { return <div className="modal-backdrop"><section className="completion glass"><div className="success-seal">{title === 'Manager Review' ? 'OK' : '!'}</div><span>MANAGER REVIEW</span><h2>{title}</h2><p>{message}</p><button className="button primary" onClick={onPrimary}>{primary}</button>{onClose && <button className="reference-button" onClick={onClose}>Close</button>}</section></div>; }
createRoot(document.getElementById('root')).render(<App />);
