/*
 * doliGAS - Solidarity purchasing group (GAS) management platform
 * Copyright (C) 2026 Luigi Grillo (doliFarm)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * @file frontend/src/components/LanguageSelector.jsx
 * @version v1.2.1
 * @author Luigi GRILLO @ doliFarm.com
 * @description Global language selector. Minimal variant designed to avoid duplicated labels.
 * STATUS: Stable.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check } from 'lucide-react';

export const LanguageSelector = ({ variant = 'default' }) => {
  const { i18n } = useTranslation();

  const languages = [
    { code: 'it', label: 'Italiano', short: 'IT', flag: '🇮🇹' },
    { code: 'en', label: 'English', short: 'EN', flag: '🇬🇧' },
    { code: 'fr', label: 'Français', short: 'FR', flag: '🇫🇷' }
  ];

  const isActive = (code) => i18n.language?.startsWith(code);

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('doliGAS_language', lng);
  };

  // VARIANT 1: MINIMAL (Welcome/Login navbar)
  // Emoji removed to avoid the visual "double" on systems without emoji fonts
  if (variant === 'minimal') {
    return (
      <div className="flex items-center gap-1 bg-slate-900/50 backdrop-blur-xl rounded-full p-1 border border-white/20 shadow-2xl">
        <div className="px-2 text-white/40">
           <Globe size={12} />
        </div>
        {languages.map((lng) => (
          <button
            key={lng.code}
            onClick={() => changeLanguage(lng.code)}
            className={`
              flex items-center justify-center px-3 py-1.5 rounded-full text-[10px] font-black transition-all duration-300
              ${isActive(lng.code) 
                ? 'bg-emerald-500 text-white shadow-lg scale-105' 
                : 'text-white/70 hover:text-white hover:bg-white/10'}
            `}
            title={lng.label}
          >
            {lng.short}
          </button>
        ))}
      </div>
    );
  }

  // VARIANT 2: LIST (user menu dropdown)
  return (
    <div className="py-1">
      <p className="px-3 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
        <Globe size={12} className="text-emerald-500"/> Lingua
      </p>
      {languages.map((lng) => (
        <button
          key={lng.code}
          onClick={() => changeLanguage(lng.code)}
          className={`
            w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors
            ${isActive(lng.code) ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}
          `}
        >
          <span className="flex items-center gap-3">
            <span className="text-lg leading-none">{lng.flag}</span> 
            <span className="tracking-tight">{lng.label}</span>
          </span>
          {isActive(lng.code) && (
            <div className="bg-emerald-500 text-white p-0.5 rounded-full">
              <Check size={10} strokeWidth={4} />
            </div>
          )}
        </button>
      ))}
    </div>
  );
};