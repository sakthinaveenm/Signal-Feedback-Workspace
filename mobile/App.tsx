import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { normalizeUrl, SignalApi } from './src/api';
import { clearConnection, readConnection, saveConnection } from './src/storage';
import { platforms, priorities, sources, statuses, types } from './src/types';
import type { Connection, Feedback, Filters, Priority, Project, Status, Summary } from './src/types';

const colors = { purple: '#7A63C2', ink: '#283044', muted: '#8D94A5', line: '#E8E9F1', bg: '#F7F7FB' };
const message = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please retry.';
function Button({ title, onPress, disabled = false, secondary = false }: { title: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondary, (disabled || pressed) && { opacity: .55 }]}><Text style={[s.buttonText, secondary && { color: colors.purple }]}>{title}</Text></Pressable>;
}
function Field({ label, value, onChangeText, multiline = false, secret = false, placeholder = '', maxLength = 10000 }: { label: string; value: string; onChangeText: (text: string) => void; multiline?: boolean; secret?: boolean; placeholder?: string; maxLength?: number }) {
  return <View style={s.field}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} style={[s.input, multiline && { minHeight: 100, textAlignVertical: 'top' }]} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#B0B4C1" multiline={multiline} secureTextEntry={secret} autoCapitalize="none" autoCorrect={false} maxLength={maxLength}/></View>;
}
function Choices({ label, values, value, onChange }: { label: string; values: readonly string[]; value: string; onChange: (value: string) => void }) {
  return <View style={s.field}><Text style={s.label}>{label}</Text><View style={s.chips}>{values.map(item => <Pressable accessibilityRole="button" accessibilityState={{ selected: value === item }} key={item} onPress={() => onChange(item)} style={[s.chip, value === item && s.chipSelected]}><Text style={[s.chipText, value === item && { color: colors.purple }]}>{item}</Text></Pressable>)}</View></View>;
}
function ErrorBox({ text }: { text: string }) { return text ? <View accessibilityRole="alert" style={s.error}><Text style={s.errorText}>{text}</Text></View> : null; }
function Empty({ title, body }: { title: string; body: string }) { return <View style={s.empty}><Text style={s.emptyIcon}>◎</Text><Text style={s.sectionTitle}>{title}</Text><Text style={s.description}>{body}</Text></View>; }

function Connect({ onConnect }: { onConnect: (connection: Connection) => void }) {
  const [url, setUrl] = useState(''), [key, setKey] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function connect() {
    setError(''); setBusy(true);
    try {
      if (key.trim().length < 32 || key.trim().length > 256) throw new Error('Enter your admin API key (32–256 characters).');
      const connection = { url: normalizeUrl(url, __DEV__), key: key.trim() };
      await new SignalApi(connection).projects();
      await saveConnection(connection);
      setKey(''); onConnect(connection);
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  return <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={s.connect} keyboardShouldPersistTaps="handled"><View style={s.logo}><Text style={s.logoText}>∿</Text></View><Text style={s.wordmark}>signal.</Text><Text style={s.eyebrow}>YOUR PRODUCTS. YOUR SIGNAL.</Text><Text style={s.hero}>Every voice.{'\n'}One place.</Text><Text style={s.description}>Connect your private feedback workspace and keep every project moving forward.</Text><View style={[s.card, { marginTop: 30 }]}><Text style={s.sectionTitle}>Connect your workspace</Text><Text style={[s.description, { marginBottom: 20 }]}>Use your deployed NestJS API, not the dashboard website URL.</Text><Field label="Backend URL" value={url} onChangeText={setUrl} placeholder="https://api.example.com" maxLength={1000}/><Field label="Admin API key" value={key} onChangeText={setKey} secret placeholder="Your private API key" maxLength={256}/><ErrorBox text={error}/><Button title={busy ? 'Connecting…' : 'Connect securely →'} disabled={busy} onPress={connect}/></View><Text style={s.footnote}>Your API key stays in this device’s secure storage. This app is for the workspace owner.</Text></ScrollView></KeyboardAvoidingView>;
}

function Editor({ mode, api, projects, selected, projectId, onClose, onSaved }: { mode: string; api: SignalApi; projects: Project[]; selected: Feedback | null; projectId?: string; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(''), [url, setUrl] = useState(''), [platform, setPlatform] = useState('Web');
  const [title, setTitle] = useState(''), [description, setDescription] = useState(''), [type, setType] = useState('Feedback'), [source, setSource] = useState('Mobile'), [contact, setContact] = useState('');
  const activeProjects = projects.filter(p => !p.archived);
  const [chosenProject, setChosenProject] = useState(projectId && activeProjects.some(p => p.id === projectId) ? projectId : activeProjects[0]?.id || '');
  const [status, setStatus] = useState<Status>(selected?.status || 'New'), [priority, setPriority] = useState<Priority>(selected?.priority || 'Medium'), [notes, setNotes] = useState(selected?.notes || '');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [projectKey, setProjectKey] = useState('');
  async function save() {
    setBusy(true); setError('');
    try {
      if (mode === 'project') {
        if (!name.trim()) throw new Error('Enter a project name.');
        const result = await api.createProject({ name: name.trim(), url: url.trim(), platform });
        setProjectKey(result.ingestionKey); onSaved();
      } else if (mode === 'detail' && selected) {
        await api.updateFeedback(selected.id, { status, priority, notes }); onSaved(); onClose();
      } else {
        if (!title.trim()) throw new Error('Enter a feedback title.');
        if (!chosenProject) throw new Error('Add an active project first.');
        await api.createFeedback({ projectId: chosenProject, title: title.trim(), description, type, source, priority, contact }); onSaved(); onClose();
      }
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  return <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { if (!busy) onClose(); }}><SafeAreaView style={s.modal}><View style={s.modalHeader}><Text style={s.sectionTitle}>{projectKey ? 'Project created' : mode === 'project' ? 'New project' : mode === 'detail' ? 'Feedback details' : 'New feedback'}</Text><Pressable accessibilityRole="button" disabled={busy} onPress={onClose} hitSlop={12}><Text style={s.link}>Close</Text></Pressable></View><KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
    {projectKey ? <><Text style={s.hero}>A new home{'\n'}for feedback.</Text><Text style={s.description}>Your project is ready. Save this submission key in your project server’s secret store. It is shown only once. It allows submission, not dashboard access.</Text><View style={[s.card, { marginVertical: 24 }]}><Text selectable style={s.key}>{projectKey}</Text></View><Text style={s.footnote}>If you lose this key, rotate it using the backend API. Do not put it in a public app bundle.</Text><Button title="Done" onPress={onClose}/></> : <>
    {mode === 'project' ? <><Text style={s.description}>Give any app, website, or idea a place in your workspace.</Text><Field label="Project name" value={name} onChangeText={setName} maxLength={120} placeholder="e.g. CaptionCopy"/><Choices label="Platform" values={platforms} value={platform} onChange={setPlatform}/><Field label="Website or repository URL (optional)" value={url} onChangeText={setUrl} maxLength={1000} placeholder="https://github.com/you/project"/></> : mode === 'detail' && selected ? <><View style={s.detailBox}><Text style={s.eyebrow}>{selected.type.toUpperCase()} · {selected.source.toUpperCase()}</Text><Text style={s.detailTitle}>{selected.title}</Text><Text selectable style={s.detailDescription}>{selected.description || 'No description provided.'}</Text><Text style={s.footnote}>{projects.find(p => p.id === selected.projectId)?.name || 'Project'} · {new Date(selected.createdAt).toLocaleString()}</Text>{!!selected.contact && <Text selectable style={s.description}>Reporter: {selected.contact}</Text>}</View><Choices label="Status" values={statuses} value={status} onChange={v => setStatus(v as Status)}/><Choices label="Priority" values={priorities} value={priority} onChange={v => setPriority(v as Priority)}/><Field label="Internal notes" value={notes} onChangeText={setNotes} multiline placeholder="Investigation, next steps, or resolution…"/></> : <><Text style={s.label}>Project</Text><View style={s.chips}>{activeProjects.map(p => <Pressable accessibilityRole="button" accessibilityState={{ selected: p.id === chosenProject }} key={p.id} style={[s.chip, chosenProject === p.id && s.chipSelected]} onPress={() => setChosenProject(p.id)}><Text style={s.chipText}>{p.name}</Text></Pressable>)}</View>{!activeProjects.length && <Text style={s.description}>Create an active project before logging feedback.</Text>}<Field label="Title" value={title} onChangeText={setTitle} maxLength={200} placeholder="What could be better?"/><Field label="Description" value={description} onChangeText={setDescription} multiline placeholder="What happened? Add a little context."/><Choices label="Type" values={types} value={type} onChange={setType}/><Choices label="Priority" values={priorities} value={priority} onChange={v => setPriority(v as Priority)}/><Choices label="Source" values={sources} value={source} onChange={setSource}/><Field label="Reporter (optional)" value={contact} onChangeText={setContact} maxLength={300} placeholder="Name or email"/></>}
    <ErrorBox text={error}/><Button title={busy ? 'Saving…' : mode === 'project' ? 'Create project' : mode === 'detail' ? 'Save changes' : 'Create feedback'} disabled={busy || (mode === 'feedback' && !activeProjects.length)} onPress={save}/></>}
    </ScrollView></KeyboardAvoidingView></SafeAreaView></Modal>;
}

function Workspace({ connection, onDisconnect }: { connection: Connection; onDisconnect: () => Promise<void> }) {
  const api = useMemo(() => new SignalApi(connection), [connection]);
  const [tab, setTab] = useState('Overview'), [projects, setProjects] = useState<Project[]>([]), [reports, setReports] = useState<Feedback[]>([]), [summary, setSummary] = useState<Summary | null>(null);
  const [projectId, setProjectId] = useState(''), [status, setStatus] = useState(''), [kind, setKind] = useState(''), [search, setSearch] = useState('');
  const [busy, setBusy] = useState(true), [moreBusy, setMoreBusy] = useState(false), [error, setError] = useState(''), [page, setPage] = useState(1), [pages, setPages] = useState(0), [total, setTotal] = useState(0);
  const [modal, setModal] = useState(''), [selected, setSelected] = useState<Feedback | null>(null), [refresh, setRefresh] = useState(0), [opening, setOpening] = useState(false);
  const generation = useRef(0);
  const filters = useMemo<Filters>(() => ({ projectId: projectId || undefined, status: status || undefined, type: kind || undefined, search: search || undefined }), [projectId, status, kind, search]);
  const reload = useCallback(() => setRefresh(v => v + 1), []);
  useEffect(() => {
    const current = ++generation.current;
    setBusy(true); setError(''); setMoreBusy(false); setReports([]); setPage(1); setPages(0);
    const timer = setTimeout(() => {
      Promise.all([api.projects(), api.summary(projectId || undefined), api.feedback(filters)])
        .then(([p, stats, feedback]) => { if (generation.current !== current) return; setProjects(p); setSummary(stats); setReports(feedback.items); setTotal(feedback.total); setPages(feedback.pages); })
        .catch(e => { if (generation.current === current) setError(message(e)); })
        .finally(() => { if (generation.current === current) setBusy(false); });
    }, search ? 350 : 0);
    return () => { clearTimeout(timer); generation.current++; };
  }, [api, projectId, filters, refresh]);
  async function loadMore() {
    if (busy || moreBusy || page >= pages) return;
    const current = generation.current;
    setMoreBusy(true);
    try {
      const next = await api.feedback(filters, page + 1);
      if (generation.current !== current) return;
      setReports(old => [...old, ...next.items.filter(item => !old.some(r => r.id === item.id))]); setPage(next.page); setPages(next.pages); setTotal(next.total);
    } catch (e) { if (generation.current === current) setError(message(e)); }
    finally { if (generation.current === current) setMoreBusy(false); }
  }
  async function openReport(report: Feedback) {
    if (opening) return;
    setOpening(true);
    try { setSelected(await api.report(report.id)); setModal('detail'); } catch (e) { setError(message(e)); } finally { setOpening(false); }
  }
  const projectName = projects.find(p => p.id === projectId)?.name;
  const newReport = () => setModal(projects.some(p => !p.archived) ? 'feedback' : 'project');
  function resetFilters() { setProjectId(''); setStatus(''); setKind(''); setSearch(''); }
  return <View style={s.flex}><View style={s.header}><Text style={s.headerBrand}>∿ signal.</Text><View style={s.ownerBadge}><Text style={s.ownerBadgeText}>OWNER WORKSPACE</Text></View></View>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={busy} onRefresh={reload} tintColor={colors.purple}/>}>
    {tab === 'Settings' ? <><Text style={s.eyebrow}>YOUR CONNECTION</Text><Text style={s.hero}>Workspace settings.</Text><View style={s.card}><Text style={s.label}>Backend</Text><Text selectable style={s.detailDescription}>{connection.url}</Text><Text style={s.description}>Your API key is stored securely on this device and is never shown here.</Text></View><View style={s.card}><Text style={s.sectionTitle}>One private workspace</Text><Text style={s.description}>This app manages your NestJS backend. It does not connect directly to MongoDB Atlas or use the website’s D1 database.</Text></View><Button title="Disconnect workspace" secondary onPress={() => Alert.alert('Disconnect workspace?', 'This removes the saved connection from this device. Your server records remain available.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Disconnect', onPress: () => { void onDisconnect().catch(e => Alert.alert('Unable to disconnect', message(e))); } }])}/></> : <>
      <Text style={s.eyebrow}>{tab === 'Projects' ? 'YOUR PROJECT PORTFOLIO' : projectName ? 'PROJECT WORKSPACE' : 'THE BIG PICTURE'}</Text><Text style={s.hero}>{projectName || (tab === 'Overview' ? 'Every voice.\nOne place.' : tab === 'Projects' ? 'Big ideas.\nBetter products.' : 'Feedback inbox.')}</Text><Text style={s.description}>{tab === 'Projects' ? 'A home for every product you’re building.' : 'Listen, prioritize, and close the loop.'}</Text><View style={{ marginVertical: 22 }}><Button title={tab === 'Projects' ? '+ Add a project' : '+ New feedback'} onPress={tab === 'Projects' ? () => setModal('project') : newReport}/></View>
      <ErrorBox text={error}/>{!!error && <Button title="Retry" secondary onPress={reload}/>}
      {tab === 'Projects' ? <>{projects.map((p, i) => <Pressable accessibilityRole="button" accessibilityLabel={`Open ${p.name}`} key={p.id} style={s.card} onPress={() => { setProjectId(p.id); setStatus(''); setKind(''); setSearch(''); setTab('Inbox'); }}><View style={s.row}><View style={[s.projectLogo, { backgroundColor: ['#EBE4F7', '#E0F0F2', '#F8EBDE'][i % 3] }]}><Text style={s.projectInitials}>{p.name.slice(0, 2).toUpperCase()}</Text></View><Text style={s.badge}>{p.archived ? 'Archived' : p.platform}</Text></View><Text style={[s.sectionTitle, { marginTop: 16 }]}>{p.name}</Text><Text style={s.description} numberOfLines={1}>{p.url || 'No URL added'}</Text><Text style={[s.link, { marginTop: 20 }]}>View feedback →</Text></Pressable>)}{!busy && !projects.length && <Empty title="Your next project starts here" body="Add an app or website to start collecting feedback."/>}</> : <>
      {tab === 'Overview' && <><View style={s.stats}>{[{ title: 'Total feedback', count: summary?.total, tint: '#EEE8F9' }, { title: 'Needs attention', count: summary?.byStatus.New, tint: '#FFF0E2' }, { title: 'In progress', count: summary?.byStatus['In progress'], tint: '#E6EFFB' }, { title: 'Resolved', count: summary?.byStatus.Resolved, tint: '#E5F4ED' }].map(stat => <View key={stat.title} style={s.stat}><View style={[s.statDot, { backgroundColor: stat.tint }]}/><Text style={s.statLabel}>{stat.title}</Text><Text style={s.statNumber}>{busy ? '—' : stat.count ?? '—'}</Text></View>)}</View><View style={[s.card, s.pulse]}><Text style={s.eyebrow}>WORKSPACE PULSE</Text><Text style={s.sectionTitle}>Small insights. Better decisions.</Text>{['Bug', 'Feature', 'Feedback'].map((t, i) => <View style={s.pulseRow} key={t}><Text style={s.pulseLabel}>{t === 'Bug' ? 'Bug reports' : t === 'Feature' ? 'Feature requests' : 'General feedback'}</Text><View style={s.bar}><View style={{ height: 6, borderRadius: 9, width: `${summary?.total ? (summary.byType[t] || 0) / summary.total * 100 : 0}%`, backgroundColor: ['#A995D5', '#96B4D7', '#9BC4B4'][i] }}/></View><Text style={s.pulseCount}>{summary?.byType[t] ?? 0}</Text></View>)}</View></>}
      <View style={s.row}><Text style={s.sectionTitle}>{tab === 'Overview' ? 'Latest feedback' : 'All feedback'}</Text><Text style={s.badge}>{busy ? '…' : total}</Text></View><TextInput accessibilityLabel="Search feedback" style={[s.input, { marginVertical: 14 }]} value={search} onChangeText={setSearch} placeholder="Search title, description, reporter…" placeholderTextColor="#A8AEBB"/>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}><View style={s.filterRow}>{[{ id: '', name: 'All projects' }, ...projects].map(p => <Pressable accessibilityRole="button" accessibilityState={{ selected: projectId === p.id }} key={p.id} onPress={() => setProjectId(p.id)} style={[s.chip, projectId === p.id && s.chipSelected]}><Text style={s.chipText}>{p.name}</Text></Pressable>)}</View></ScrollView>
      <Choices label="Status" values={['All statuses', ...statuses]} value={status || 'All statuses'} onChange={v => setStatus(v === 'All statuses' ? '' : v)}/><Choices label="Type" values={['All types', ...types]} value={kind || 'All types'} onChange={v => setKind(v === 'All types' ? '' : v)}/>
      {busy ? <ActivityIndicator color={colors.purple} style={{ margin: 30 }}/> : reports.map(report => <Pressable key={report.id} accessibilityRole="button" accessibilityLabel={`Open feedback: ${report.title}`} disabled={opening} style={s.feedbackCard} onPress={() => { void openReport(report); }}><View style={s.row}><Text style={s.feedbackType}>{report.type === 'Bug' ? '◉' : report.type === 'Feature' ? '✧' : '◌'} {report.type.toUpperCase()}</Text><Text style={[s.statusBadge, report.status === 'Resolved' && { color: '#699C82', backgroundColor: '#EAF5EF' }]}>{report.status}</Text></View><Text style={s.feedbackTitle}>{report.title}</Text><Text style={s.description} numberOfLines={1}>{projects.find(p => p.id === report.projectId)?.name} · {report.source}</Text><View style={[s.row, { marginTop: 16 }]}><Text style={s.priority}>{report.priority} priority</Text><Text style={s.date}>{new Date(report.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} →</Text></View></Pressable>)}
      {!busy && !error && !reports.length && <><Empty title={search || projectId || status || kind ? 'No matching feedback' : 'Your next improvement starts here'} body={search || projectId || status || kind ? 'Try another search or clear your filters.' : 'Add a project, then log your first bug, idea, or comment.'}/>{!!(search || projectId || status || kind) && <Button title="Clear filters" secondary onPress={resetFilters}/>}</>}
      {page < pages && !busy && <Button title={moreBusy ? 'Loading…' : 'Load more feedback'} disabled={moreBusy} secondary onPress={() => { void loadMore(); }}/>}
      {opening && <ActivityIndicator color={colors.purple} style={{ marginTop: 15 }}/>}</>}
      </>}
      <Text style={s.footnote}>A little signal. A lot of clarity.</Text></ScrollView>
    <View style={s.tabs}>{[{ name: 'Overview', icon: '▦' }, { name: 'Inbox', icon: '◫' }, { name: 'Projects', icon: '▱' }, { name: 'Settings', icon: '⚙' }].map(item => <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === item.name }} key={item.name} style={s.tab} onPress={() => setTab(item.name)}><Text style={[s.tabIcon, tab === item.name && { color: colors.purple }]}>{item.icon}</Text><Text style={[s.tabText, tab === item.name && { color: colors.purple }]}>{item.name}</Text></Pressable>)}</View>
    {!!modal && <Editor key={`${modal}-${selected?.id || ''}`} mode={modal} api={api} projects={projects} selected={selected} projectId={projectId} onSaved={reload} onClose={() => { setModal(''); setSelected(null); }}/>}</View>;
}

export default function App() {
  const [connection, setConnection] = useState<Connection | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  useEffect(() => { readConnection().then(setConnection).catch(() => setError('Could not read your saved connection. Connect again below.')).finally(() => setLoading(false)); }, []);
  return <SafeAreaProvider><SafeAreaView style={s.screen}><StatusBar style="dark"/>{loading ? <ActivityIndicator style={s.flex} color={colors.purple}/> : connection ? <Workspace connection={connection} onDisconnect={async () => { await clearConnection(); setConnection(null); }}/>: <><ErrorBox text={error}/><Connect onConnect={value => { setError(''); setConnection(value); }}/></>}</SafeAreaView></SafeAreaProvider>;
}

const s = StyleSheet.create({
  flex: { flex: 1 }, screen: { flex: 1, backgroundColor: colors.bg },
  connect: { padding: 25, paddingTop: 35, flexGrow: 1 }, logo: { width: 47, height: 47, borderRadius: 14, backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center' }, logoText: { color: 'white', fontSize: 35, lineHeight: 42 },
  wordmark: { fontSize: 33, fontWeight: '800', color: colors.ink, letterSpacing: -1.5, marginTop: 8, marginBottom: 35 }, eyebrow: { fontSize: 10, letterSpacing: 1.7, color: '#A394BF', fontWeight: '700', marginBottom: 12 },
  hero: { fontSize: 35, lineHeight: 43, color: colors.ink, fontWeight: '700', letterSpacing: -1.4, marginBottom: 12 }, description: { fontSize: 13, color: colors.muted, lineHeight: 21 }, footnote: { fontSize: 11, color: '#A2A7B5', lineHeight: 19, marginTop: 24, marginBottom: 14 },
  card: { padding: 22, backgroundColor: 'white', borderWidth: 1, borderColor: colors.line, borderRadius: 17, marginBottom: 16 }, sectionTitle: { fontSize: 17, fontWeight: '600', color: colors.ink, marginBottom: 6 },
  field: { marginBottom: 20 }, label: { color: '#6E778B', fontSize: 12, fontWeight: '600', marginBottom: 9 }, input: { padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#E2E4ED', backgroundColor: 'white', fontSize: 14, color: colors.ink, minHeight: 49 },
  button: { minHeight: 50, backgroundColor: colors.purple, borderRadius: 11, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' }, buttonText: { color: 'white', fontSize: 14, fontWeight: '600' }, secondary: { backgroundColor: '#F0EBFA', borderWidth: 1, borderColor: '#E7DFF5' },
  error: { backgroundColor: '#FFF0ED', borderRadius: 10, padding: 14, marginVertical: 12 }, errorText: { color: '#B05E55', fontSize: 13, lineHeight: 20 },
  header: { paddingHorizontal: 23, paddingVertical: 17, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, headerBrand: { fontSize: 25, color: colors.purple, fontWeight: '800', letterSpacing: -1 }, ownerBadge: { backgroundColor: '#F1EDF9', borderRadius: 6, padding: 7 }, ownerBadgeText: { fontSize: 8, letterSpacing: 1, color: '#9B88BD', fontWeight: '700' }, content: { padding: 23, paddingTop: 30, paddingBottom: 24 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 }, stat: { width: '48%', flexGrow: 1, backgroundColor: 'white', borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 17 }, statDot: { width: 20, height: 20, borderRadius: 7, position: 'absolute', top: 15, right: 14 }, statLabel: { fontSize: 11, color: '#8B92A1', marginTop: 14 }, statNumber: { fontSize: 32, color: colors.ink, marginTop: 12, fontWeight: '600' },
  pulse: { marginBottom: 27 }, pulseRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20 }, pulseLabel: { fontSize: 10, color: '#8F96A6', width: 95 }, bar: { flex: 1, height: 6, borderRadius: 9, backgroundColor: '#F1EEF7', overflow: 'hidden' }, pulseCount: { fontSize: 11, color: '#8F96A6', minWidth: 16, textAlign: 'right' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 3 }, chip: { backgroundColor: 'white', borderWidth: 1, borderColor: colors.line, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 9 }, chipSelected: { backgroundColor: '#EEE8F9', borderColor: '#DCD0F0' }, chipText: { fontSize: 11, color: '#8B80A0' }, filterRow: { flexDirection: 'row', gap: 8 },
  badge: { fontSize: 10, color: '#9D8ABB', backgroundColor: '#F1ECF9', borderRadius: 6, padding: 7, overflow: 'hidden' }, projectLogo: { width: 43, height: 43, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, projectInitials: { color: '#9B88BD', fontSize: 15, fontWeight: '600' }, link: { color: colors.purple, fontSize: 13, fontWeight: '600' },
  feedbackCard: { padding: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: 'white', borderRadius: 14, marginBottom: 12 }, feedbackType: { fontSize: 10, letterSpacing: .7, color: '#AC99CB' }, statusBadge: { fontSize: 10, color: '#9A85BB', backgroundColor: '#F0ECF8', paddingVertical: 5, paddingHorizontal: 8, borderRadius: 6, overflow: 'hidden' }, feedbackTitle: { color: '#485469', fontWeight: '600', fontSize: 15, lineHeight: 22, marginTop: 12, marginBottom: 5 }, priority: { fontSize: 10, color: '#B79A79' }, date: { fontSize: 10, color: '#A6ADBB' },
  empty: { paddingVertical: 30, alignItems: 'center', gap: 7 }, emptyIcon: { fontSize: 37, color: '#B6A4D4', marginBottom: 9 }, tabs: { flexDirection: 'row', paddingVertical: 10, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: colors.line }, tab: { flex: 1, alignItems: 'center', paddingVertical: 5, gap: 4 }, tabIcon: { fontSize: 24, color: '#AFB4C0' }, tabText: { fontSize: 10, color: '#9CA3B1', fontWeight: '500' },
  modal: { flex: 1, backgroundColor: colors.bg }, modalHeader: { padding: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.line }, modalBody: { padding: 24, paddingBottom: 50 }, detailBox: { padding: 20, backgroundColor: 'white', borderWidth: 1, borderColor: colors.line, borderRadius: 14, marginBottom: 24 }, detailTitle: { fontSize: 23, color: colors.ink, lineHeight: 31, fontWeight: '600', marginBottom: 14 }, detailDescription: { color: '#7E899C', fontSize: 14, lineHeight: 23, marginBottom: 10 }, key: { color: colors.ink, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13, lineHeight: 23 },
});
