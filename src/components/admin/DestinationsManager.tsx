'use client';

import { useState, useEffect } from 'react';

interface Store { id: string; name: string; created_at: string; }
interface Version { id: string; store_id: string; version_number: number; is_published: boolean; }
interface Floor { id: string; name: string; store_version_id: string; level_number: number; }
interface NavNode { id: string; label: string | null; floor_id: string; type: string; }
interface Section {
    id: string; name: string; category: string | null;
    description: string | null; icon: string | null;
    node_id: string; floor_id: string;
}

export default function DestinationsManager() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const [stores, setStores] = useState<Store[]>([]);
    const [versions, setVersions] = useState<Version[]>([]);
    const [floors, setFloors] = useState<Floor[]>([]);
    const [nodes, setNodes] = useState<NavNode[]>([]);
    const [sections, setSections] = useState<Section[]>([]);

    // UI Filters
    const [selectedStoreId, setSelectedStoreId] = useState<string>('');
    const [selectedFloorId, setSelectedFloorId] = useState<string>('');

    // Form State
    const [editingSection, setEditingSection] = useState<Section | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);

    const [formData, setFormData] = useState({
        name: '', category: '', description: '', icon: '', node_id: '', floor_id: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        try {
            setLoading(true);
            const res = await fetch('/api/admin/destinations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'fetchInitialData' })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Failed to fetch data');

            setStores(data.stores);
            setVersions(data.versions);
            setFloors(data.floors);
            setNodes(data.nodes);
            setSections(data.sections);

            if (data.stores.length > 0) setSelectedStoreId(data.stores[0].id);
        } catch (err: any) {
            setErrorMsg(err.message);
        } finally {
            setLoading(false);
        }
    }

    // Computed derived local state based on filters
    const currentStoreVersions = versions.filter(v => v.store_id === selectedStoreId);
    const currentStoreVersionIds = currentStoreVersions.map(v => v.id);
    const availableFloors = floors.filter(f => currentStoreVersionIds.includes(f.store_version_id));

    useEffect(() => {
        if (availableFloors.length > 0 && !availableFloors.find(f => f.id === selectedFloorId)) {
            setSelectedFloorId(availableFloors[0].id);
        } else if (availableFloors.length === 0) {
            setSelectedFloorId('');
        }
    }, [availableFloors, selectedFloorId]);

    const availableNodes = nodes.filter(n => n.floor_id === selectedFloorId && n.type !== 'edge');
    const filteredSections = sections.filter(s => s.floor_id === selectedFloorId);

    function handleOpenCreate() {
        setEditingSection(null);
        setFormData({ name: '', category: '', description: '', icon: '', node_id: '', floor_id: selectedFloorId });
        setIsFormOpen(true);
    }

    function handleEdit(sec: Section) {
        setEditingSection(sec);
        setFormData({
            name: sec.name,
            category: sec.category || '',
            description: sec.description || '',
            icon: sec.icon || '',
            node_id: sec.node_id,
            floor_id: sec.floor_id
        });
        setIsFormOpen(true);
    }

    async function handleDelete(id: string) {
        if (!confirm('Are you sure you want to delete this destination? This will unlink the node (the node itself remains on the map).')) return;

        try {
            const res = await fetch('/api/admin/destinations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'deleteSection', payload: { id } })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);
            setSections(prev => prev.filter(s => s.id !== id));
        } catch (err: any) {
            alert('Failed to delete: ' + err.message);
        }
    }

    async function handleSaveForm(e: React.FormEvent) {
        e.preventDefault();
        setErrorMsg('');
        setSaving(true);
        try {
            const action = editingSection ? 'updateSection' : 'createSection';
            const payload = {
                id: editingSection?.id,
                ...formData
            };

            const res = await fetch('/api/admin/destinations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, payload })
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            if (editingSection) {
                setSections(prev => prev.map(s => s.id === data.section.id ? data.section : s));
            } else {
                setSections(prev => [...prev, data.section]);
            }

            setIsFormOpen(false);
        } catch (err: any) {
            setErrorMsg(err.message);
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <div className="text-white">Loading data...</div>;

    return (
        <div className="space-y-6">
            {errorMsg && (
                <div className="bg-red-500/20 border border-red-500 text-red-100 p-4 rounded-md">
                    {errorMsg}
                </div>
            )}

            <div className="flex gap-4 p-4 bg-[#111623] rounded-lg border border-white/5">
                <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">Store</label>
                    <select
                        className="w-full bg-[#1A1F2E] border border-white/10 text-white p-2 rounded-md"
                        value={selectedStoreId} onChange={e => setSelectedStoreId(e.target.value)}
                    >
                        {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
                <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">Floor</label>
                    <select
                        className="w-full bg-[#1A1F2E] border border-white/10 text-white p-2 rounded-md"
                        value={selectedFloorId} onChange={e => setSelectedFloorId(e.target.value)}
                    >
                        {availableFloors.length === 0 && <option value="">No floors found</option>}
                        {availableFloors.map(f => (
                            <option key={f.id} value={f.id}>{f.name} (L{f.level_number})</option>
                        ))}
                    </select>
                </div>
            </div>

            {selectedFloorId && (
                <div className="bg-[#111623] rounded-lg border border-white/5 p-4">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-white">Destinations</h2>
                        <button
                            onClick={handleOpenCreate}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-md text-sm font-semibold transition-colors"
                        >
                            + New Destination
                        </button>
                    </div>

                    {filteredSections.length === 0 ? (
                        <p className="text-gray-400 text-sm text-center py-8">No destinations defined for this floor.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-gray-300">
                                <thead className="text-xs uppercase bg-[#1A1F2E] text-gray-400">
                                    <tr>
                                        <th className="px-4 py-3 rounded-tl-md">Icon</th>
                                        <th className="px-4 py-3">Name</th>
                                        <th className="px-4 py-3">Category</th>
                                        <th className="px-4 py-3">Linked Node</th>
                                        <th className="px-4 py-3 text-right rounded-tr-md">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSections.map(sec => {
                                        const nodeDef = nodes.find(n => n.id === sec.node_id);
                                        return (
                                            <tr key={sec.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                                                <td className="px-4 py-3 text-xl">{sec.icon || '📍'}</td>
                                                <td className="px-4 py-3 font-medium text-white">{sec.name}</td>
                                                <td className="px-4 py-3">
                                                    <span className="px-2 py-1 bg-white/10 rounded-full text-xs">{sec.category || 'Uncategorized'}</span>
                                                </td>
                                                <td className="px-4 py-3 text-xs font-mono text-cyan-400">
                                                    {nodeDef ? (nodeDef.label || `Node ${nodeDef.id.slice(0, 6)}`) : 'Unlinked Node!'}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button onClick={() => handleEdit(sec)} className="text-blue-400 hover:text-blue-300 mr-3">Edit</button>
                                                    <button onClick={() => handleDelete(sec.id)} className="text-red-400 hover:text-red-300">Delete</button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {isFormOpen && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#111623] border border-white/10 w-full max-w-lg rounded-xl overflow-hidden shadow-2xl">
                        <div className="bg-[#1A1F2E] px-6 py-4 flex justify-between items-center border-b border-white/5">
                            <h3 className="text-lg font-bold text-white">{editingSection ? 'Edit Destination' : 'Create Destination'}</h3>
                            <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-white">&times;</button>
                        </div>
                        <form onSubmit={handleSaveForm} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-1">Destination Name *</label>
                                <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-[#0A0D14] border border-white/10 rounded-md p-2 text-white" placeholder="e.g. Bill Counter" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 mb-1">Category</label>
                                    <input type="text" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full bg-[#0A0D14] border border-white/10 rounded-md p-2 text-white" placeholder="e.g. Billing, Electronics" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 mb-1">Icon Emoji</label>
                                    <input type="text" value={formData.icon} onChange={e => setFormData({ ...formData, icon: e.target.value })} className="w-full bg-[#0A0D14] border border-white/10 rounded-md p-2 text-white" placeholder="🛒" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-1">Description</label>
                                <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={2} className="w-full bg-[#0A0D14] border border-white/10 rounded-md p-2 text-white resize-none" placeholder="Details about this destination..." />
                            </div>

                            <div className="pt-2 border-t border-white/5">
                                <label className="block text-xs font-semibold text-amber-500 mb-1">Linked Map Node *</label>
                                <select required value={formData.node_id} onChange={e => setFormData({ ...formData, node_id: e.target.value })} className="w-full bg-[#0A0D14] border border-amber-500/30 rounded-md p-2 text-white">
                                    <option value="" disabled>-- Select a Node from the Map --</option>
                                    {availableNodes.map(n => (
                                        <option key={n.id} value={n.id}>
                                            {n.label ? `${n.label} (ID: ${n.id.slice(0, 6)})` : `Node ${n.id.slice(0, 8)} [${n.type}]`}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">
                                    A destination must be linked to an existing node on the floor. Use the Map Builder to add nodes if needed.
                                </p>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 rounded-md font-semibold text-gray-300 hover:bg-white/5">Cancel</button>
                                <button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2 rounded-md font-semibold">
                                    {saving ? 'Saving...' : 'Save Destination'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
