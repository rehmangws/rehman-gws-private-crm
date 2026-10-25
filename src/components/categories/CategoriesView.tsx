import React, { useState } from 'react';
import { Category, Lead } from '../../types/crm';
import { CRMStorage } from '../../services/crmStorage';
import { Tags, Plus, Edit2, Archive, Check } from 'lucide-react';

interface CategoriesViewProps {
  categories: Category[];
  leads: Lead[];
  onRefreshData: () => Promise<void>;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  categories,
  leads,
  onRefreshData,
}) => {
  const [newCatName, setNewCatName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const newCat: Category = {
      id: `cat-${Date.now()}`,
      name: newCatName.trim(),
      isCustom: true,
      isArchived: false,
    };
    await CRMStorage.saveCategory(newCat);
    setNewCatName('');
    await onRefreshData();
  };

  const handleUpdate = async (cat: Category) => {
    if (!editName.trim()) return;
    await CRMStorage.saveCategory({ ...cat, name: editName.trim() });
    setEditingId(null);
    await onRefreshData();
  };

  const handleArchiveToggle = async (cat: Category) => {
    await CRMStorage.saveCategory({ ...cat, isArchived: !cat.isArchived });
    await onRefreshData();
  };

  const displayedCategories = categories.filter((c) => (showArchived ? true : !c.isArchived));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#0E1626] border border-[#1E2C4A] p-6 rounded-2xl shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-blue-500/20 text-cyan-400 border border-blue-500/30">
                <Tags className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-bold text-white">Business Category Registry</h2>
            </div>
            <p className="text-xs text-slate-400">
              Manage core industries and specialized niches. Seeded with 50+ commercial categories.
            </p>
          </div>

          <form onSubmit={handleCreate} className="flex items-center gap-2">
            <input
              type="text"
              required
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="New Category Name..."
              className="p-2 bg-[#080B11] border border-[#1E2C4A] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </form>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {displayedCategories.map((cat) => {
          const count = leads.filter((l) => l.categoryId === cat.id).length;
          const isEditing = editingId === cat.id;

          return (
            <div
              key={cat.id}
              className="p-3.5 rounded-xl bg-[#0E1626] border border-[#1E2C4A] hover:border-cyan-500/40 transition-colors flex items-center justify-between gap-2 shadow-sm"
            >
              {isEditing ? (
                <div className="flex items-center gap-1.5 flex-1">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full p-1 bg-[#080B11] border border-cyan-500 rounded text-xs text-white"
                  />
                  <button
                    onClick={() => handleUpdate(cat)}
                    className="p-1 text-emerald-400 hover:text-emerald-300"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="min-w-0">
                  <span className="text-xs font-bold text-white block truncate">{cat.name}</span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {count} {count === 1 ? 'lead' : 'leads'} assigned
                  </span>
                </div>
              )}

              <div className="flex items-center gap-1 shrink-0">
                {!isEditing && (
                  <button
                    onClick={() => {
                      setEditingId(cat.id);
                      setEditName(cat.name);
                    }}
                    className="p-1 rounded text-slate-500 hover:text-white"
                    title="Edit Name"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={() => handleArchiveToggle(cat)}
                  className={`p-1 rounded ${
                    cat.isArchived ? 'text-amber-400' : 'text-slate-500 hover:text-amber-400'
                  }`}
                  title={cat.isArchived ? 'Restore' : 'Archive'}
                >
                  <Archive className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
