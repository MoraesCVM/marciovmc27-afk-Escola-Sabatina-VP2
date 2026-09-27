'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Member } from '@/lib/types';
import { User, Check, ChevronDown, Search } from 'lucide-react';

interface MemberDropdownSelectorProps {
  label: string;
  value: string;
  onChange: (value: string, selectedMember?: Member) => void;
  members: Member[];
  placeholder?: string;
  required?: boolean;
}

export const MemberDropdownSelector: React.FC<MemberDropdownSelectorProps> = ({
  label,
  value,
  onChange,
  members,
  placeholder = 'Digite para buscar membro...',
  required = false,
}) => {
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setQuery(value);
  }

  // Filter members dynamically
  const filteredMembers = members.filter((m) =>
    m.name.toLowerCase().includes(query.toLowerCase()) ||
    m.className.toLowerCase().includes(query.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (member: Member) => {
    setQuery(member.name);
    onChange(member.name, member);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val);
    setIsOpen(true);
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <div className="relative flex items-center">
        <div className="absolute left-3 text-gray-400 pointer-events-none">
          <User className="w-4 h-4" />
        </div>

        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full pl-9 pr-10 py-2.5 bg-white border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6b1d2f] focus:border-transparent transition-all shadow-xs"
        />

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-3 text-gray-400 hover:text-gray-600 focus:outline-none"
        >
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Autocomplete Dropdown List */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-gray-100 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3 py-1.5 text-[11px] font-medium text-gray-400 bg-gray-50 flex items-center gap-1.5">
            <Search className="w-3 h-3" />
            <span>{filteredMembers.length} membro(s) encontrado(s)</span>
          </div>

          {filteredMembers.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500 text-center italic">
              Nenhum membro encontrado com &quot;{query}&quot;.
              <br />
              <span className="text-xs text-[#6b1d2f] font-normal">
                Você pode manter este texto como nome do professor.
              </span>
            </div>
          ) : (
            filteredMembers.map((member) => {
              const isSelected = member.name.toLowerCase() === value.toLowerCase();
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => handleSelect(member)}
                  className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between hover:bg-[#fdf8f5] transition-colors text-sm ${
                    isSelected ? 'bg-[#f8eeea] font-semibold text-[#6b1d2f]' : 'text-gray-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        isSelected
                          ? 'bg-[#6b1d2f] text-white'
                          : 'bg-gray-100 text-gray-700 border border-gray-200'
                      }`}
                    >
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium leading-tight">{member.name}</span>
                        {member.isTeacher && (
                          <span className="bg-amber-100 text-amber-800 text-[9px] font-extrabold px-1.5 py-0.2 rounded border border-amber-300">
                            🎓 Professor
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        Classe: {member.className} • {member.status}
                      </div>
                    </div>
                  </div>

                  {isSelected && <Check className="w-4 h-4 text-[#6b1d2f]" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
