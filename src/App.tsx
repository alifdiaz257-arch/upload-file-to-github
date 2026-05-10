import { Menu, ShieldAlert, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

type GitProvider = 'github' | 'gitlab'

type SelectedFile = {
  path: string
  file: File
}

type FolderInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  webkitdirectory?: string
  directory?: string
}

function App() {
  const [provider, setProvider] = useState<GitProvider>('github')
  const [repoUrl, setRepoUrl] = useState('https://github.com/alifdiaz257-arch/Test.git')
  const [branch, setBranch] = useState('main')
  const [folderName, setFolderName] = useState('')
  const [files, setFiles] = useState<SelectedFile[]>([])
  const [isSending, setIsSending] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [rememberToken, setRememberToken] = useState(false)
  const [activeTab, setActiveTab] = useState<'start' | 'upload'>('start')
  const [showHelp, setShowHelp] = useState(false)

  const providerConfig = useMemo(() => {
    if (provider === 'github') {
      return {
        title: 'GitHub Lift Upload',
        tokenLabel: 'GitHub Personal Access Token',
        placeRepo: 'https://github.com/username/repository',
        accent: 'from-blue-600 to-cyan-400',
      }
    }
    return {
      title: 'GitLab Lift Upload',
      tokenLabel: 'GitLab Personal Access Token',
      placeRepo: 'https://gitlab.com/username/repository',
      accent: 'from-blue-700 to-indigo-400',
    }
  }, [provider])

  const [token, setToken] = useState('')

  useEffect(() => {
    if (provider === 'github') {
      setRepoUrl('https://github.com/alifdiaz257-arch/Test.git')
    }
  }, [provider])

  const parseGithubRepo = (url: string) => {
    const clean = url.trim().replace(/\.git$/, '')
    const match = clean.match(/github\.com\/(.+?)\/(.+?)(?:$|\s)/i)
    if (!match) return null
    return { owner: match[1], repo: match[2] }
  }

  const readFileAsBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const data = reader.result as string
        const base64 = data.split(',')[1]
        resolve(base64)
      }
      reader.onerror = () => reject(new Error(`Gagal membaca file: ${file.name}`))
      reader.readAsDataURL(file)
    })

  const saveTokenToPersonal = (value: string) => {
    localStorage.setItem(`liftupload_token_${provider}`, value)
    localStorage.setItem('liftupload_token_saved', 'true')
  }

  const getSavedToken = () => localStorage.getItem(`liftupload_token_${provider}`) || ''

  const askUseSavedToken = () => {
    const existing = getSavedToken()
    if (!existing) return
    const useIt = window.confirm('Apakah anda mau menggunakan personal acces token lagi?')
    if (useIt) {
      setToken(existing)
      setLogs((prev) => ['🔁 Menggunakan token yang tersimpan.', ...prev].slice(0, 8))
    }
  }

  const onSelectFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files
    if (!selected) return

    const mapped: SelectedFile[] = Array.from(selected).map((file) => ({
      file,
      path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
    }))

    const derivedFolder = mapped[0]?.path.split('/')[0] ?? ''
    setFolderName(derivedFolder)
    setFiles(mapped)
    setLogs((prev) => [
      `📂 Folder terpilih: ${derivedFolder || 'tanpa nama'}`,
      `✅ Total file: ${mapped.length}`,
      ...prev,
    ].slice(0, 8))
  }

  const onSelectSingleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files
    if (!selected) return

    const mapped: SelectedFile[] = Array.from(selected).map((file) => ({
      file,
      path: file.name,
    }))

    setFolderName('Pilihan file manual')
    setFiles(mapped)
    setLogs((prev) => [`📄 File manual dipilih: ${mapped.length} file`, ...prev].slice(0, 8))
  }

  const testGithubAccess = async () => {
    if (!repoUrl || !token) {
      setLogs((prev) => ['⚠️ Isi repo URL dan token untuk test akses.', ...prev].slice(0, 8))
      return
    }
    const parsed = parseGithubRepo(repoUrl)
    if (!parsed) {
      setLogs((prev) => ['❌ Format repo tidak valid.', ...prev].slice(0, 8))
      return
    }

    try {
      const res = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Akses repo gagal (${res.status}) ${text}`)
      }

      setLogs((prev) => ['✅ Test akses repo sukses. Token bisa baca repo.', ...prev].slice(0, 8))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal test token'
      setLogs((prev) => [`❌ ${message}`, '🔧 Solusi: token wajib Contents Read & Write + hak akses repo.', ...prev].slice(0, 8))
    }
  }

  const handleSend = async () => {
    if (!repoUrl || !token || files.length === 0) {
      setLogs((prev) => ['⚠️ Lengkapi URL repo, token, dan pilih folder dulu.', ...prev].slice(0, 8))
      return
    }

    if (provider === 'gitlab') {
      setLogs((prev) => ['⚠️ Real upload saat ini aktif untuk GitHub dahulu.', ...prev].slice(0, 8))
      return
    }

    const parsed = parseGithubRepo(repoUrl)
    if (!parsed) {
      setLogs((prev) => ['❌ Format link repo GitHub tidak valid.', ...prev].slice(0, 8))
      return
    }

    try {
      setIsSending(true)
      setLogs((prev) => ['🚀 Memulai REAL upload ke GitHub...', ...prev].slice(0, 8))

      if (rememberToken) {
        saveTokenToPersonal(token)
      }

      for (let i = 0; i < files.length; i += 1) {
        const item = files[i]
        const base64 = await readFileAsBase64(item.file)
        const path = item.path

        const getUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`
        let sha: string | undefined

        const existingRes = await fetch(`${getUrl}?ref=${encodeURIComponent(branch)}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
          },
        })

        if (existingRes.ok) {
          const existing = (await existingRes.json()) as { sha?: string }
          sha = existing.sha
        }

        const putRes = await fetch(getUrl, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: `LiftUpload: upload ${path}`,
            content: base64,
            branch,
            ...(sha ? { sha } : {}),
          }),
        })

        if (!putRes.ok) {
          const errText = await putRes.text()
          throw new Error(`Gagal upload ${path}: ${putRes.status} ${errText}`)
        }

        setLogs((prev) => [`✅ Uploaded (${i + 1}/${files.length}): ${path}`, ...prev].slice(0, 8))
      }

      setLogs((prev) => ['🎉 Semua file berhasil terkirim ke GitHub dengan nama asli!', ...prev].slice(0, 8))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Terjadi error upload'
      setLogs((prev) => [`❌ ${message}`, ...prev].slice(0, 8))
    } finally {
      setIsSending(false)
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-gradient-to-b from-blue-950 via-blue-900 to-white text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-20 -left-20 h-72 w-72 animate-pulse rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-96 w-96 animate-bounce rounded-full bg-blue-400/20 blur-3xl [animation-duration:6s]" />
      </div>

      <section className="relative mx-auto w-full max-w-6xl px-4 py-10 md:px-8">
        <button
          type="button"
          onClick={() => setShowHelp(true)}
          className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-full bg-white px-4 py-2 font-black text-blue-900 shadow-xl"
        >
          <Menu size={18} /> Help
        </button>

        <header className="mb-8 rounded-3xl border border-blue-200/30 bg-white/10 p-6 backdrop-blur-xl">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-cyan-200">LiftUpload System</p>
          <h1 className="mt-2 text-3xl font-black leading-tight md:text-5xl">
            Website Upload Folder ➜ <span className="text-cyan-300">GitHub & GitLab</span>
          </h1>
          <p className="mt-3 max-w-3xl text-blue-100">
            Solusi biar upload tidak ribet: pilih folder sekali, struktur dan nama file tetap asli, lalu kirim ke repository
            lewat link repo. Tema biru putih, animasi penuh, font tebal unik, dan menu GitHub/GitLab dibuat berbeda.
          </p>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => setActiveTab('start')}
              className={`rounded-xl px-4 py-2 font-black ${activeTab === 'start' ? 'bg-white text-blue-900' : 'bg-blue-700 text-white'}`}
            >
              Get Started
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`rounded-xl px-4 py-2 font-black ${activeTab === 'upload' ? 'bg-white text-blue-900' : 'bg-blue-700 text-white'}`}
            >
              Upload Center
            </button>
          </div>
        </header>

        {activeTab === 'start' && (
          <section className="mb-6 rounded-3xl border border-blue-200/50 bg-white/90 p-6 text-blue-950 shadow-2xl">
            <h2 className="flex items-center gap-2 text-3xl font-black"><Sparkles /> Get Started LiftUpload</h2>
            <ol className="mt-4 list-decimal space-y-3 pl-6 text-sm font-bold leading-relaxed">
              <li>Pilih menu GitHub (real upload aktif) atau GitLab (UI tersedia).</li>
              <li>Masukkan URL repo target, default sudah mengarah ke repo Test Anda.</li>
              <li>Isi branch (contoh: main) dan personal access token.</li>
              <li>Klik <b>Test Akses GitHub</b> untuk cek token sebelum upload.</li>
              <li>Pilih upload dengan <b>Folder</b> (struktur tetap) atau <b>File Manual</b>.</li>
              <li>Klik kirim, file akan diupload tanpa rename nama file.</li>
            </ol>
          </section>
        )}

        {showHelp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-blue-950/60 p-4">
            <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 text-blue-950 shadow-2xl">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-2xl font-black"><ShieldAlert /> Bantuan Error & Solusi</h3>
                <button onClick={() => setShowHelp(false)} className="rounded-full bg-blue-100 p-2"><X size={18} /></button>
              </div>
              <div className="space-y-4 text-sm font-bold">
                <p>403 Resource not accessible by personal access token:</p>
                <ul className="list-disc space-y-2 pl-6">
                  <li>Pastikan token punya permission <b>Contents: Read and Write</b>.</li>
                  <li>Pastikan akun token punya akses write ke repo.</li>
                  <li>Untuk classic token gunakan scope <b>repo</b>.</li>
                  <li>Cek branch benar dan tidak diblok branch protection.</li>
                </ul>
                <p>Jika upload gagal, lakukan:</p>
                <ol className="list-decimal space-y-2 pl-6">
                  <li>Klik Test Akses GitHub.</li>
                  <li>Perbarui token lalu simpan ulang token.</li>
                  <li>Coba upload file kecil dulu untuk test.</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'upload' && (

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-3xl border border-white/40 bg-white text-blue-950 shadow-2xl shadow-blue-900/20">
            <div className={`rounded-t-3xl bg-gradient-to-r ${providerConfig.accent} p-5 text-white`}>
              <h2 className="text-2xl font-extrabold">{providerConfig.title}</h2>
              <p className="text-sm text-blue-50">Pilih platform di menu atas, lalu kirim folder ke repo target.</p>
            </div>

            <div className="space-y-4 p-5 md:p-6">
              <div className="flex gap-3">
                <button
                  onClick={() => setProvider('github')}
                  className={`rounded-xl px-4 py-2 font-extrabold transition ${
                    provider === 'github'
                      ? 'bg-blue-700 text-white shadow-lg shadow-blue-500/40'
                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  }`}
                >
                  Menu GitHub
                </button>
                <button
                  onClick={() => setProvider('gitlab')}
                  className={`rounded-xl px-4 py-2 font-extrabold transition ${
                    provider === 'gitlab'
                      ? 'bg-indigo-700 text-white shadow-lg shadow-indigo-500/40'
                      : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                  }`}
                >
                  Menu GitLab
                </button>
              </div>

              <label className="block">
                <span className="mb-1 block text-sm font-bold">Link Repository</span>
                <input
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder={providerConfig.placeRepo}
                  className="w-full rounded-xl border border-blue-200 px-4 py-3 font-semibold text-blue-950 outline-none ring-blue-400 transition focus:ring"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-bold">Branch</span>
                  <input
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full rounded-xl border border-blue-200 px-4 py-3 font-semibold text-blue-950 outline-none ring-blue-400 transition focus:ring"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-bold">{providerConfig.tokenLabel}</span>
                  <input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="••••••••••••••"
                    className="w-full rounded-xl border border-blue-200 px-4 py-3 font-semibold text-blue-950 outline-none ring-blue-400 transition focus:ring"
                  />
                </label>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2">
                <input
                  id="remember-token"
                  type="checkbox"
                  checked={rememberToken}
                  onChange={(e) => setRememberToken(e.target.checked)}
                />
                <label htmlFor="remember-token" className="text-sm font-bold text-blue-900">
                  Simpan personal acces token di personal folder (penyimpanan lokal browser)
                </label>
                <button
                  onClick={askUseSavedToken}
                  type="button"
                  className="ml-auto rounded-lg bg-blue-700 px-3 py-1 text-xs font-bold text-white"
                >
                  Gunakan Token Tersimpan
                </button>
              </div>

              <label className="block rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50 p-4 text-center transition hover:bg-blue-100">
                <span className="block text-sm font-bold text-blue-900">Pilih Folder dari perangkat</span>
                <span className="mt-1 block text-xs text-blue-700">Semua file tetap sesuai nama asli, tidak di-rename</span>
                <input
                  {...({
                    type: 'file',
                    className: 'hidden',
                    webkitdirectory: '',
                    directory: '',
                    multiple: true,
                    onChange: onSelectFiles,
                  } as FolderInputProps)}
                />
              </label>

              <button
                onClick={testGithubAccess}
                type="button"
                className="w-full rounded-xl bg-cyan-600 px-4 py-3 text-lg font-black text-white transition hover:bg-cyan-700"
              >
                Test Akses GitHub
              </button>

              <label className="block rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50 p-4 text-center transition hover:bg-indigo-100">
                <span className="block text-sm font-bold text-indigo-900">Pilih File Manual</span>
                <span className="mt-1 block text-xs text-indigo-700">Upload file tertentu tanpa pilih folder</span>
                <input type="file" className="hidden" multiple onChange={onSelectSingleFiles} />
              </label>

              <button
                onClick={handleSend}
                disabled={isSending}
                className="w-full rounded-xl bg-blue-700 px-4 py-3 text-lg font-black text-white transition hover:scale-[1.01] hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {isSending ? 'Mengirim Folder...' : `Kirim Folder ke ${provider.toUpperCase()}`}
              </button>

              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm font-bold text-blue-900">Folder terdeteksi: {folderName || '-'}</p>
                <p className="text-xs font-semibold text-blue-700">Jumlah file: {files.length}</p>
              </div>
            </div>
          </article>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-blue-200/50 bg-white/90 p-5 text-blue-950 shadow-xl">
              <h3 className="text-xl font-black">Cara Pakai</h3>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm font-semibold">
                <li>Pilih menu GitHub atau GitLab di atas.</li>
                <li>Masukkan link repository dan token akses.</li>
                <li>Pilih folder yang ingin dikirim.</li>
                <li>Klik tombol kirim folder.</li>
                <li>Struktur folder dan nama file tetap sama.</li>
              </ol>
            </section>

            <section className="rounded-3xl border border-blue-200/50 bg-white/90 p-5 text-blue-950 shadow-xl">
              <h3 className="text-xl font-black">Info Website</h3>
              <p className="mt-2 text-sm font-semibold leading-relaxed">
                Website ini dibuat untuk mempermudah upload seluruh isi folder ke repository tanpa upload satu-satu.
                Desain biru putih dibuat beda dari yang lain dengan efek animasi latar, tombol bold unik, dan pemisahan
                menu GitHub/GitLab agar lebih jelas.
              </p>
            </section>

            <section className="rounded-3xl border border-blue-200/50 bg-blue-950 p-5 text-blue-100 shadow-xl">
              <h3 className="text-lg font-black text-white">Aktivitas LiftUpload</h3>
              <ul className="mt-3 space-y-2 text-xs font-bold">
                {logs.length === 0 ? <li>Belum ada aktivitas...</li> : logs.map((log) => <li key={log}>{log}</li>)}
              </ul>
            </section>
          </aside>
        </div>
        )}
      </section>
    </main>
  )
}

export default App
