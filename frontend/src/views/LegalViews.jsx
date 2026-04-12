/**
 * @file frontend/src/views/LegalViews.jsx
 * @version v2.3
 * @author Luigi GRILLO @ doliFarm.com
 * @description Pagine statiche Privacy e Termini. Supporto i18n integrale per il contenuto.
 * @status Integro, Completo, Robusto.
 * @date 2026-02-23
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next'; 
import { ArrowLeft, Shield, FileText } from 'lucide-react';
import { Button } from '../components/ui-kit';

// --- 1. CONTENUTI TRADOTTI (Usabili nei Modali e nelle Viste) ---
export const PrivacyContent = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-4 text-slate-600 text-sm leading-relaxed">
      <h3 className="font-bold text-slate-800 text-lg">{t('legal_content.privacy.intro_title')}</h3>
      <p>{t('legal_content.privacy.intro_text')}</p>
      
      <h3 className="font-bold text-slate-800 text-lg">{t('legal_content.privacy.data_title')}</h3>
      <p>{t('legal_content.privacy.data_text')}</p>
      
      <h3 className="font-bold text-slate-800 text-lg">{t('legal_content.privacy.usage_title')}</h3>
      <p>{t('legal_content.privacy.usage_text')}</p>
      
      <h3 className="font-bold text-slate-800 text-lg">{t('legal_content.privacy.rights_title')}</h3>
      <p>{t('legal_content.privacy.rights_text')}</p>
    </div>
  );
};

export const TermsContent = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-4 text-slate-600 text-sm leading-relaxed">
      <h3 className="font-bold text-slate-800 text-lg">{t('legal_content.terms.acceptance_title')}</h3>
      <p>{t('legal_content.terms.acceptance_text')}</p>
      
      <h3 className="font-bold text-slate-800 text-lg">{t('legal_content.terms.payments_title')}</h3>
      <p>{t('legal_content.terms.payments_text')}</p>
      
      <h3 className="font-bold text-slate-800 text-lg">{t('legal_content.terms.responsibility_title')}</h3>
      <p>{t('legal_content.terms.responsibility_text')}</p>
    </div>
  );
};

// --- 2. LAYOUT PAGINA INTERA ---
const LegalLayout = ({ title, icon: Icon, children }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  return (
    <div className="max-w-3xl mx-auto p-6 md:p-12 animate-in fade-in">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6 gap-2 text-slate-500">
        <ArrowLeft size={18} /> {t('common.back', 'Indietro')}
      </Button>
      
      <div className="bg-white p-8 md:p-12 rounded-3xl shadow-xl shadow-slate-100 border border-slate-100">
        <div className="flex items-center gap-3 mb-8 pb-8 border-b border-slate-100">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Icon size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-800">{title}</h1>
            <p className="text-slate-400 text-sm font-medium mt-1">
              {t('legal.last_updated')}: 14/01/2026
            </p>
          </div>
        </div>
        <div className="prose prose-slate prose-sm md:prose-base max-w-none">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- 3. EXPORT DELLE VISTE COMPLETE ---
export const PrivacyView = () => {
  const { t } = useTranslation();
  return (
    <LegalLayout title={t('legal.privacy_title')} icon={Shield}>
      <PrivacyContent />
    </LegalLayout>
  );
};

export const TermsView = () => {
  const { t } = useTranslation();
  return (
    <LegalLayout title={t('legal.terms_title')} icon={FileText}>
      <TermsContent />
    </LegalLayout>
  );
};