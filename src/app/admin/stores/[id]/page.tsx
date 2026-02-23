'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import type { StoreVersion } from '@/lib/versionManager';
import VersionCard from '@/components/admin/VersionCard';

interface Store {
    id: string;
    name: string;
    length_meters: number;
    width_meters: number;
    aisle_count: number;
    aisle_width: number;
    corridor_spacing: number;
    grid_cell_size: number;
    created_at: string;
}

export default function StoreDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: storeId } = use(params);
    const [store, setStore] = useState<Store | null>(null);
    const [versions, setVersions] = useState<StoreVersion[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // Validation State
    const [isValidating, setIsValidating] = useState(false);
    const [validationReport, setValidationReport] = useState<{
        versionId: string;
        valid: boolean;
        errors: string[];
        stats: { nodes: number; edges: number; destinations: number };
    } | null>(null);

    const router = useRouter();

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [storeId]);

    async function loadData() {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/stores?id=${storeId}&versions=true`);
            const data = await res.json();

            if (data.store) setStore(data.store);
            if (data.versions) setVersions(data.versions);
        } catch (err) {
            console.error('Failed to fetch store:', err);
        }
        setLoading(false);
    }

    // 1. First trigger validation
    async function handlePublishRequest(versionId: string) {
        setIsValidating(true);
        setValidationReport(null);
        try {
            const res = await fetch('/api/admin/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ versionId }),
            });
            const data = await res.json();
            setValidationReport({
                versionId,
                valid: data.valid,
                errors: data.errors || [],
                stats: data.stats || { nodes: 0, edges: 0, destinations: 0 },
            });
        } catch (err) {
            console.error('Validation failed:', err);
            alert('A network error occurred during validation.');
        }
        setIsValidating(false);
    }

    // 2. Proceed to actual publish if valid
    async function confirmPublish() {
        if (!validationReport?.valid) return;

        setActionLoading(true);
        await fetch('/api/admin/stores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'publish', versionId: validationReport.versionId, storeId }),
        });
        setValidationReport(null);
        await loadData();
        setActionLoading(false);
    }

    async function handleRevert(versionId: string) {
        setActionLoading(true);
        await fetch('/api/admin/stores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'clone', versionId, storeId }),
        });
        await loadData();
        setActionLoading(false);
    }

    function handleEdit(versionId: string) {
        router.push(`/admin/stores/${storeId}/versions/${versionId}`);
    }

    async function handleNewVersion() {
        setActionLoading(true);
        const latestVersion = versions[0];
        if (latestVersion) {
            await fetch('/api/admin/stores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'clone', versionId: latestVersion.id, storeId }),
            });
        }
        await loadData();
        setActionLoading(false);
    }

    if (loading) {
        return (
            <div className="admin-page">
                <div className="admin-loading">
                    <div className="spinner" />
                    <p>Loading store...</p>
                </div>
            </div>
        );
    }

    if (!store) {
        return (
            <div className="admin-page">
                <div className="admin-empty-state">
                    <h3>Store not found</h3>
                    <button onClick={() => router.push('/admin/dashboard')} className="admin-btn-primary mt-4">
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-page">
            {/* Breadcrumb */}
            <div className="admin-breadcrumb">
                <button onClick={() => router.push('/admin/dashboard')} className="admin-breadcrumb-link">
                    Stores
                </button>
                <span className="admin-breadcrumb-sep">/</span>
                <span className="admin-breadcrumb-current">{store.name}</span>
            </div>

            {/* Store header */}
            <div className="admin-page-header">
                <div>
                    <h1 className="admin-page-title">{store.name}</h1>
                    <div className="admin-store-dimensions">
                        <span>{store.length_meters}m × {store.width_meters}m</span>
                        <span className="admin-store-dot">·</span>
                        <span>{store.aisle_count} aisles</span>
                        <span className="admin-store-dot">·</span>
                        <span>{(store.length_meters * store.width_meters).toFixed(0)} m²</span>
                    </div>
                </div>
                <button
                    onClick={handleNewVersion}
                    disabled={actionLoading}
                    className="admin-btn-primary"
                >
                    {actionLoading ? (
                        <>
                            <span className="spinner-sm" />
                            Working...
                        </>
                    ) : (
                        <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            New Version
                        </>
                    )}
                </button>
            </div>

            {/* Versions */}
            <div className="admin-section">
                <h2 className="admin-section-title">
                    Map Versions
                    <span className="admin-section-count">{versions.length}</span>
                </h2>

                {versions.length === 0 ? (
                    <div className="admin-empty-state small">
                        <p>No versions yet</p>
                    </div>
                ) : (
                    <div className="admin-version-list">
                        {versions.map((v) => (
                            <VersionCard
                                key={v.id}
                                version={v}
                                onPublish={handlePublishRequest}
                                onRevert={handleRevert}
                                onEdit={handleEdit}
                                isPublishing={actionLoading || isValidating}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Store config info */}
            <div className="admin-section">
                <h2 className="admin-section-title">Configuration</h2>
                <div className="admin-config-grid">
                    <div className="admin-config-item">
                        <span className="admin-config-label">Grid Cell Size</span>
                        <span className="admin-config-value">{store.grid_cell_size}m</span>
                    </div>
                    <div className="admin-config-item">
                        <span className="admin-config-label">Aisle Width</span>
                        <span className="admin-config-value">{store.aisle_width}m</span>
                    </div>
                    <div className="admin-config-item">
                        <span className="admin-config-label">Corridor Spacing</span>
                        <span className="admin-config-value">{store.corridor_spacing}m</span>
                    </div>
                    <div className="admin-config-item">
                        <span className="admin-config-label">Floor Area</span>
                        <span className="admin-config-value">{(store.length_meters * store.width_meters).toFixed(0)} m²</span>
                    </div>
                </div>
            </div>

            {/* Validation Modal */}
            {validationReport && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-[#151522] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
                        <div className="p-6 border-b border-white/10 shrink-0">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                {validationReport.valid ? (
                                    <><span className="text-emerald-400">✓</span> Validation Passed</>
                                ) : (
                                    <><span className="text-red-400">⚠️</span> Validation Failed</>
                                )}
                            </h2>
                            <p className="text-sm text-white/50 mt-1">Pre-publish system integrity check.</p>
                        </div>

                        <div className="p-6 overflow-y-auto max-h-[60vh]">
                            <div className="flex gap-4 mb-6 text-sm">
                                <div className="bg-white/5 px-3 py-2 rounded flex-1 text-center">
                                    <div className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Nodes</div>
                                    <div className="text-white font-medium">{validationReport.stats.nodes}</div>
                                </div>
                                <div className="bg-white/5 px-3 py-2 rounded flex-1 text-center">
                                    <div className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Edges</div>
                                    <div className="text-white font-medium">{validationReport.stats.edges}</div>
                                </div>
                                <div className="bg-white/5 px-3 py-2 rounded flex-1 text-center">
                                    <div className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Dests</div>
                                    <div className="text-white font-medium">{validationReport.stats.destinations}</div>
                                </div>
                            </div>

                            {validationReport.errors.length > 0 ? (
                                <ul className="space-y-2">
                                    {validationReport.errors.map((err, i) => (
                                        <li key={i} className="text-sm text-red-400/90 bg-red-400/10 px-4 py-3 rounded-lg border border-red-400/20 flex items-start gap-3 leading-snug">
                                            <span className="shrink-0 mt-0.5">•</span>
                                            <span>{err}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="text-center py-6 text-emerald-400/90 bg-emerald-400/10 rounded-lg border border-emerald-400/20">
                                    <p className="font-medium">All systems green.</p>
                                    <p className="text-xs mt-1 text-emerald-400/60">The navigation graph is fully contiguous and ready for AR customers.</p>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-white/10 bg-white/[0.02] shrink-0 flex gap-3 justify-end">
                            <button
                                onClick={() => setValidationReport(null)}
                                className="px-5 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                Cancel
                            </button>
                            {validationReport.valid && (
                                <button
                                    onClick={confirmPublish}
                                    disabled={actionLoading}
                                    className="px-5 py-2.5 rounded-lg text-sm font-medium bg-[#10b981] hover:bg-[#059669] text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all disabled:opacity-50"
                                >
                                    {actionLoading ? 'Publishing...' : 'Yes, Publish Version'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
