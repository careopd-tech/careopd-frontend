import React from 'react';
import { Info } from 'lucide-react';
import Modal from '../ui/Modal';

const CONTACT_COPY = {
  email: {
    title: 'Update Email',
    summary: 'Email changes affect login access, password reset, and account recovery.'
  },
  mobile: {
    title: 'Update Mobile',
    summary: 'Mobile number changes affect login access, OTP delivery, and account recovery.'
  }
};

const ContactChangeInfoModal = ({ type = 'email', isOpen, onClose }) => {
  const content = CONTACT_COPY[type] || CONTACT_COPY.email;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={content.title}>
      <div className="space-y-3">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2 items-start text-[12px] text-amber-900">
          <Info size={14} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-bold uppercase tracking-wide">Verification Protected</p>
            <p className="mt-1">{content.summary}</p>
          </div>
        </div>

        <div className="text-[13px] text-slate-600 space-y-2">
          <p>This action has been separated from profile editing to protect genuine users from accidental lockout.</p>
          <p>The verified self-service change flow will update the login contact only after the new contact is confirmed.</p>
          <p>Until then, your current login contact remains active and unchanged.</p>
        </div>
      </div>
    </Modal>
  );
};

export default ContactChangeInfoModal;
