var LandingPage = ({ onStart }) => (
    <div className="min-h-screen bg-white flex flex-col justify-center items-center px-4 text-center">
        <div className="text-6xl mb-3">🇮🇩</div>
        <h1 className="text-3xl md:text-5xl font-black text-brand-dark mb-3">7 Kebiasaan <span className="text-brand-red">Anak Indonesia Hebat</span></h1>
        <p className="text-gray-500 max-w-md text-sm md:text-base mb-8">Pencatatan pembiasaan karakter positif siswa {SCHOOL_IDENTITY.name}.</p>
        <Button onClick={onStart} className="text-base py-3.5 px-8">Masuk ke Aplikasi</Button>
    </div>
);
