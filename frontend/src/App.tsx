import { useState, useEffect } from "react"
import axios from "axios"

export default function App() {
  const [repoUrl, setRepoUrl] = useState("")
  const [deployId, setDeployId] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleDeploy = async () => {
    if (!repoUrl) return
    setLoading(true)
    setStatus("initializing")
    // Force the caret to disappear by removing focus from the input
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    try {
      const res = await axios.post("http://localhost:3000/deploy", { repoUrl })
      setDeployId(res.data.id)
      setStatus(res.data.status) // usually "uploaded"
    } catch (err) {
      console.error(err)
      setStatus("error")
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!deployId) return

    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`http://localhost:3000/status?id=${deployId}`)
        setStatus(res.data.status)
        
        if (res.data.status === "deployed") {
          setLoading(false)
          clearInterval(interval)
        }
      } catch (err) {
        console.error(err)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [deployId])

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col items-center justify-center p-4 font-sans">
      <div className="max-w-xl w-full space-y-6">
        
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            Import GitHub Repository Here!
          </h1>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input 
            type="text"
            placeholder="https://github.com/username/repo" 
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value.trim())}
            className="w-full sm:w-[400px] px-4 py-2 text-left border border-gray-300 bg-white rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
          <button 
            onClick={handleDeploy} 
            disabled={loading}
            className="px-6 py-2 bg-gray-900 text-white font-medium rounded-md hover:bg-gray-600 disabled:opacity-50 cursor-pointer transition-all duration-200"
          >
            {loading ? "Deploying..." : "Deploy"}
          </button>
        </div>

        {status && (
          <div className="mt-4 p-4 border border-gray-200 rounded-md bg-white shadow-sm">
            <h3 className="font-medium text-gray-700 capitalize">
              Status: {status === "uploaded" ? "Cloned & Uploaded" : status === "processing" ? "Building Project" : status}
            </h3>
            
            {status === "deployed" && deployId && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                <p className="text-sm text-gray-500">Deployment ready:</p>
                <a 
                  href={`http://${deployId}.localhost:3001`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline break-all"
                >
                  http://{deployId}.localhost:3001
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
