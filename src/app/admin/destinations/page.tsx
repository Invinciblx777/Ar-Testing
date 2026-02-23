import DestinationsManager from '@/components/admin/DestinationsManager';

export const metadata = {
    title: 'Destinations - NavGrid Admin',
    description: 'Manage destination targets (sections) for AR navigation.',
};

export default function DestinationsPage() {
    return (
        <div className="p-8">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Destination Management</h1>
                <p className="text-gray-400">
                    Create, edit, and link navigation targets across stores and floors.
                </p>
            </header>

            <DestinationsManager />
        </div>
    );
}
