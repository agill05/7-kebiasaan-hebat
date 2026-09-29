var Card = ({ children, className = '', compact = false }) => (
    <div className={`bg-white rounded-2xl shadow-soft border border-gray-100 ${compact ? 'p-3 md:p-4' : 'p-5'} ${className}`}>{children}</div>
);

var Button = ({ children, onClick, variant = 'primary', className = '', fullWidth = false, disabled = false, type = 'button' }) => {
    const variants = {
        primary: 'bg-brand-red text-white hover:bg-red-600 shadow-md hover:shadow-lg',
        secondary: 'bg-brand-blue text-white hover:bg-blue-600 shadow-md',
        outline: 'border-2 border-brand-red text-brand-red hover:bg-red-50',
        white: 'bg-white text-gray-800 border border-gray-200 hover:bg-gray-50',
        green: 'bg-brand-green text-white hover:bg-emerald-600 shadow-md',
        amber: 'bg-amber-500 text-white hover:bg-amber-600 shadow-md'
    };
    return (
        <button type={type} disabled={disabled} onClick={onClick} className={`font-bold py-2.5 px-4 rounded-xl transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}>
            {children}
        </button>
    );
};

var EmptyState = ({ icon = '📂', title = 'Belum Ada Data', description = 'Data akan muncul setelah ditambahkan atau disinkronkan.' }) => (
    <div className="text-center py-12 px-4 space-y-3">
        <div className="text-5xl opacity-80 mb-2">{icon}</div>
        <h4 className="text-base font-extrabold text-gray-700">{title}</h4>
        <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">{description}</p>
    </div>
);
