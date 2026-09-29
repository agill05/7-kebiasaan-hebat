var showAlert = {
    success: (title, text = '') => Swal.fire({ icon: 'success', title, text, confirmButtonColor: '#EF4444', customClass: { popup: 'rounded-2xl', confirmButton: 'rounded-xl font-bold px-5 py-2.5' } }),
    error: (title, text = '') => Swal.fire({ icon: 'error', title, text, confirmButtonColor: '#EF4444', customClass: { popup: 'rounded-2xl', confirmButton: 'rounded-xl font-bold px-5 py-2.5' } }),
    warning: (title, text = '') => Swal.fire({ icon: 'warning', title, text, confirmButtonColor: '#EF4444', customClass: { popup: 'rounded-2xl', confirmButton: 'rounded-xl font-bold px-5 py-2.5' } }),
    confirm: async (title, text = '', confirmText = 'Ya, Lanjutkan') => Swal.fire({
        title, text, icon: 'warning', showCancelButton: true, confirmButtonColor: '#EF4444', cancelButtonColor: '#6B7280', confirmButtonText: confirmText, cancelButtonText: 'Batal',
        customClass: { popup: 'rounded-2xl', confirmButton: 'rounded-xl font-bold px-5 py-2.5', cancelButton: 'rounded-xl font-bold px-5 py-2.5' }
    })
};
