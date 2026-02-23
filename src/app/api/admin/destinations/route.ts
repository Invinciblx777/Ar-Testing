import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

async function getAuthenticatedAdmin() {
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll(); },
                setAll() { /* read-only in API routes */ },
            },
        }
    );

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return { error: 'Not authenticated', status: 401 };

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

    if (!profile || profile.role !== 'admin') {
        return { error: 'Admin access required', status: 403 };
    }

    return { supabase, user };
}

export async function POST(request: Request) {
    try {
        const auth = await getAuthenticatedAdmin();
        if ('error' in auth) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }
        const { supabase } = auth;

        const body = await request.json();
        const { action, payload } = body;

        switch (action) {
            case 'fetchInitialData': {
                const { data: stores, error: e1 } = await supabase.from('stores').select('*').order('created_at', { ascending: false });
                const { data: versions, error: e2 } = await supabase.from('store_versions').select('*');
                const { data: floors, error: e3 } = await supabase.from('floors').select('*');
                const { data: nodes, error: e4 } = await supabase.from('navigation_nodes').select('id, label, floor_id, type');
                const { data: sections, error: e5 } = await supabase.from('sections').select('*');

                if (e1 || e2 || e3 || e4 || e5) {
                    throw new Error('Failed to fetch initial data');
                }

                return NextResponse.json({
                    success: true,
                    stores: stores || [],
                    versions: versions || [],
                    floors: floors || [],
                    nodes: nodes || [],
                    sections: sections || []
                });
            }
            case 'createSection': {
                const { name, category, description, icon, node_id, floor_id } = payload;
                if (!name || !node_id) {
                    return NextResponse.json({ error: 'Name and node_id are required' }, { status: 400 });
                }

                // Check for duplicate name on the same floor
                if (floor_id) {
                    const { data: existing } = await supabase
                        .from('sections')
                        .select('id')
                        .eq('floor_id', floor_id)
                        .eq('name', name)
                        .maybeSingle();

                    if (existing) {
                        return NextResponse.json({ error: 'A destination with this name already exists on this floor.' }, { status: 400 });
                    }
                }

                const { data, error } = await supabase.from('sections').insert({
                    name, category, description, icon, node_id, floor_id
                }).select().single();

                if (error) throw error;
                return NextResponse.json({ success: true, section: data });
            }
            case 'updateSection': {
                const { id, name, category, description, icon, node_id, floor_id } = payload;
                if (!id || !name || !node_id) {
                    return NextResponse.json({ error: 'ID, Name, and node_id are required' }, { status: 400 });
                }

                if (floor_id) {
                    const { data: existing } = await supabase
                        .from('sections')
                        .select('id')
                        .eq('floor_id', floor_id)
                        .eq('name', name)
                        .neq('id', id)
                        .maybeSingle();

                    if (existing) {
                        return NextResponse.json({ error: 'A destination with this name already exists on this floor.' }, { status: 400 });
                    }
                }

                const { data, error } = await supabase.from('sections').update({
                    name, category, description, icon, node_id, floor_id
                }).eq('id', id).select().single();

                if (error) throw error;
                return NextResponse.json({ success: true, section: data });
            }
            case 'deleteSection': {
                const { id } = payload;
                if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

                const { error } = await supabase.from('sections').delete().eq('id', id);
                if (error) throw error;
                return NextResponse.json({ success: true });
            }
            default:
                return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
        }

    } catch (err: any) {
        console.error('[admin/destinations API]', err);
        return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
    }
}
