
import React, { useState, useMemo } from 'react';
import { HospitalUnit } from '../types';
import { Plus, Trash2, Building2, Edit3, Check, ChevronDown, ChevronUp, Hash, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  units: HospitalUnit[];
  onAdd: (unit: Omit<HospitalUnit, 'id'>) => void;
  onUpdate: (unit: HospitalUnit) => void;
  onDelete: (id: string) => void;
}

const UnitManager: React.FC<Props> = ({ units, onAdd, onUpdate, onDelete }) => {
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState(10);
  const [bedNames, setBedNames] = useState<string[]>([]);
  const [showBedNamesConfig, setShowBedNamesConfig] = useState(false);
  const [filterText, setFilterText] = useState('');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState(0);
  const [editName, setEditName] = useState('');
  const [editBedNames, setEditBedNames] = useState<string[]>([]);
  const [unitToDelete, setUnitToDelete] = useState<string | null>(null);

  const sortedUnits = useMemo(() => {
    return [...units]
      .filter(u => u.name.toLowerCase().includes(filterText.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [units, filterText]);

  const handleCapacityChange = (val: number) => {
    const safeVal = Math.max(1, Math.min(100, val || 1));
    setCapacity(safeVal);
    const newBedNames = Array.from({ length: safeVal }, (_, i) => bedNames[i] || String(i + 1));
    setBedNames(newBedNames);
  };

  const handleBedNameChange = (index: number, value: string) => {
    const updated = [...bedNames];
    updated[index] = value.toUpperCase();
    setBedNames(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Defina um nome para a unidade.");
      return;
    }
    
    const finalBedNames = Array.from({ length: capacity }, (_, i) => bedNames[i] || String(i + 1));
      
    onAdd({ 
      name: name.toUpperCase().trim(), 
      capacity, 
      bedNames: finalBedNames 
    });
    
    setName('');
    setCapacity(10);
    setBedNames([]);
    setShowBedNamesConfig(false);
  };

  const startEdit = (unit: HospitalUnit) => {
    setEditingId(unit.id);
    setEditValue(unit.capacity);
    setEditBedNames(unit.bedNames || Array.from({ length: unit.capacity }, (_, i) => String(i + 1)));
    setEditName(unit.name);
  };

  const handleEditBedNameChange = (index: number, value: string) => {
    const updated = [...editBedNames];
    updated[index] = value.toUpperCase();
    setEditBedNames(updated);
  };

  const saveEdit = (unit: HospitalUnit) => {
    const finalBedNames = Array.from({ length: editValue }, (_, i) => editBedNames[i] || String(i + 1));
    onUpdate({ ...unit, name: editName.toUpperCase().trim(), capacity: editValue, bedNames: finalBedNames });
    setEditingId(null);
  };

  return (
    <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-100 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <h3 className="text-2xl font-black text-gray-900 flex items-center">
          <Building2 className="mr-3 text-indigo-600" /> Configuração de Setores Operacionais
        </h3>
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            placeholder="Filtrar enfermarias..." 
            className="w-full bg-slate-50 border border-slate-200 p-4 pl-12 rounded-2xl font-bold text-xs uppercase outline-none focus:ring-4 focus:ring-indigo-100"
          />
          {filterText && (
            <button onClick={() => setFilterText('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500">
              <X size={16} />
            </button>
          )}
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="mb-10 bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Identificação da Unidade</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: UTI CARDIOLÓGICA" className="w-full bg-white border border-slate-200 p-4 rounded-2xl font-bold text-slate-900 focus:ring-4 focus:ring-indigo-100 outline-none uppercase" />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Capacidade (Leitos)</label>
            <div className="flex gap-4">
              <input type="number" required value={capacity} onChange={(e) => handleCapacityChange(parseInt(e.target.value) || 0)} className="flex-1 bg-white border border-slate-200 p-4 rounded-2xl font-bold text-slate-900 outline-none" min="1" max="100" />
              <button 
                type="button" 
                onClick={() => setShowBedNamesConfig(!showBedNamesConfig)}
                className={`px-6 rounded-2xl font-black text-[10px] uppercase transition-all flex items-center gap-2 ${showBedNamesConfig ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
              >
                {showBedNamesConfig ? <ChevronUp size={16}/> : <ChevronDown size={16}/>} Nomear Leitos
              </button>
            </div>
          </div>
        </div>

        {showBedNamesConfig && (
          <div className="p-6 bg-white rounded-2xl border border-slate-100 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-60 overflow-y-auto shadow-inner">
            {Array.from({ length: capacity }).map((_, i) => (
              <div key={i} className="space-y-1">
                <span className="text-[8px] font-black text-slate-400">Leito {i+1}</span>
                <input 
                  value={bedNames[i] || ''} 
                  onChange={(e) => handleBedNameChange(i, e.target.value)}
                  placeholder={`EX: 202-${i+1}`}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold uppercase outline-none focus:border-indigo-400"
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-4">
          <button type="submit" className="px-10 bg-indigo-600 text-white font-black py-4 rounded-2xl hover:bg-indigo-700 transition-all flex items-center justify-center uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-100">
            <Plus className="w-4 h-4 mr-2" /> Cadastrar Novo Setor
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {sortedUnits.map(unit => (
          <div key={unit.id} className="p-6 border border-slate-100 rounded-[2rem] bg-white hover:border-indigo-100 hover:shadow-xl transition-all flex flex-col group min-h-[220px]">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <p className="font-black text-slate-900 text-sm uppercase leading-tight">{unit.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Hash size={12} className="text-indigo-400" />
                  <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-tighter">{unit.capacity} Leitos Operacionais</p>
                </div>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); setUnitToDelete(unit.id); }} 
                className="p-3 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                title="Excluir Unidade"
              >
                <Trash2 size={22} />
              </button>
            </div>
            
            <div className="mt-auto space-y-4">
              {editingId === unit.id ? (
                <div className="space-y-4 animate-in slide-in-from-top-2">
                  <div className="flex flex-col gap-2">
                    <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-slate-50 border-2 p-3 rounded-xl font-bold text-xs uppercase" placeholder="NOME DA UNIDADE" />
                    <div className="flex items-center gap-2">
                      <input type="number" value={editValue} onChange={e => setEditValue(parseInt(e.target.value) || 0)} className="w-full bg-slate-50 border-2 p-3 rounded-xl font-bold text-xs" min="1" />
                      <button onClick={() => saveEdit(unit)} className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg"><Check size={18}/></button>
                    </div>
                  </div>
                  <div className="max-h-32 overflow-y-auto grid grid-cols-2 gap-2 p-2 bg-slate-50 rounded-xl border">
                    {Array.from({ length: editValue }).map((_, i) => (
                      <input 
                        key={i}
                        value={editBedNames[i] || ''}
                        onChange={(e) => handleEditBedNameChange(i, e.target.value)}
                        className="p-2 border rounded-lg text-[8px] font-black uppercase bg-white outline-none focus:border-indigo-400"
                        placeholder={`L-${i+1}`}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <button onClick={() => startEdit(unit)} className="w-full py-3 bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center transition-all">
                  <Edit3 size={14} className="mr-2" /> Editar Setor / Leitos
                </button>
              )}
            </div>
          </div>
        ))}
        {sortedUnits.length === 0 && (
          <div className="col-span-full py-20 text-center bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
             <Building2 className="mx-auto text-slate-200 mb-4" size={48} />
             <p className="text-slate-400 font-black uppercase text-xs">Nenhuma unidade operacional encontrada</p>
          </div>
        )}
      </div>

      {unitToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 size={32} />
            </div>
            <h3 className="text-2xl font-black text-slate-900 uppercase mb-4">Excluir Setor?</h3>
            <p className="text-sm font-bold text-slate-500 mb-8">
              Atenção: Deseja excluir este setor e todos os dados vinculados a ele permanentemente? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setUnitToDelete(null)} 
                className="flex-1 py-4 bg-slate-100 text-slate-600 font-black uppercase rounded-2xl hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  onDelete(unitToDelete);
                  setUnitToDelete(null);
                }} 
                className="flex-1 py-4 bg-red-600 text-white font-black uppercase rounded-2xl hover:bg-red-700 transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnitManager;
