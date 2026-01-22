'use client'
import { GRNDSIcon, BREAKPOINTIcon, CHALLENGERIcon, ABSOLUTEIcon, XIcon } from '@/components/RankIcons'

export default function RankIconsTestPage() {
  return (
    <div className="min-h-screen bg-black p-12">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-white text-4xl font-bold mb-2 font-mono">#GRNDS Rank Icons</h1>
        <p className="text-white/60 mb-12 font-mono">Visual preview of all rank icons</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* GRNDS */}
          <div className="flex flex-col items-center p-8 bg-white/5 rounded-lg border border-white/10">
            <div className="mb-4">
              <GRNDSIcon size={150} />
            </div>
            <h2 className="text-white text-xl font-bold mb-2 font-mono">GRNDS</h2>
            <p className="text-white/60 text-sm font-mono">#ff8c00</p>
            <div className="mt-4">
              <GRNDSIcon size={50} />
            </div>
            <div className="mt-2">
              <GRNDSIcon size={30} />
            </div>
          </div>
          
          {/* BREAKPOINT */}
          <div className="flex flex-col items-center p-8 bg-white/5 rounded-lg border border-white/10">
            <div className="mb-4">
              <BREAKPOINTIcon size={150} />
            </div>
            <h2 className="text-white text-xl font-bold mb-2 font-mono">BREAKPOINT</h2>
            <p className="text-white/60 text-sm font-mono">#2a2a2a</p>
            <div className="mt-4">
              <BREAKPOINTIcon size={50} />
            </div>
            <div className="mt-2">
              <BREAKPOINTIcon size={30} />
            </div>
          </div>
          
          {/* CHALLENGER */}
          <div className="flex flex-col items-center p-8 bg-white/5 rounded-lg border border-white/10">
            <div className="mb-4">
              <CHALLENGERIcon size={150} />
            </div>
            <h2 className="text-white text-xl font-bold mb-2 font-mono">CHALLENGER</h2>
            <p className="text-white/60 text-sm font-mono">#dc2626</p>
            <div className="mt-4">
              <CHALLENGERIcon size={50} />
            </div>
            <div className="mt-2">
              <CHALLENGERIcon size={30} />
            </div>
          </div>
          
          {/* ABSOLUTE */}
          <div className="flex flex-col items-center p-8 bg-white/5 rounded-lg border border-white/10">
            <div className="mb-4">
              <ABSOLUTEIcon size={150} />
            </div>
            <h2 className="text-white text-xl font-bold mb-2 font-mono">ABSOLUTE</h2>
            <p className="text-white/60 text-sm font-mono">#f59e0b</p>
            <div className="mt-4">
              <ABSOLUTEIcon size={50} />
            </div>
            <div className="mt-2">
              <ABSOLUTEIcon size={30} />
            </div>
          </div>
          
          {/* X */}
          <div className="flex flex-col items-center p-8 bg-white/5 rounded-lg border border-white/10">
            <div className="mb-4">
              <XIcon size={150} />
            </div>
            <h2 className="text-white text-xl font-bold mb-2 font-mono">X</h2>
            <p className="text-white/60 text-sm font-mono">#ffffff</p>
            <div className="mt-4">
              <XIcon size={50} />
            </div>
            <div className="mt-2">
              <XIcon size={30} />
            </div>
          </div>
        </div>
        
        {/* Size comparison */}
        <div className="mt-16">
          <h2 className="text-white text-2xl font-bold mb-8 font-mono">Size Comparison</h2>
          <div className="flex items-end gap-8 p-8 bg-white/5 rounded-lg border border-white/10">
            <div className="flex flex-col items-center">
              <GRNDSIcon size={200} />
              <p className="text-white/60 text-sm mt-4 font-mono">200px</p>
            </div>
            <div className="flex flex-col items-center">
              <GRNDSIcon size={100} />
              <p className="text-white/60 text-sm mt-4 font-mono">100px</p>
            </div>
            <div className="flex flex-col items-center">
              <GRNDSIcon size={50} />
              <p className="text-white/60 text-sm mt-4 font-mono">50px</p>
            </div>
            <div className="flex flex-col items-center">
              <GRNDSIcon size={30} />
              <p className="text-white/60 text-sm mt-4 font-mono">30px</p>
            </div>
            <div className="flex flex-col items-center">
              <GRNDSIcon size={20} />
              <p className="text-white/60 text-sm mt-4 font-mono">20px</p>
            </div>
          </div>
        </div>
        
        {/* All ranks side by side */}
        <div className="mt-16">
          <h2 className="text-white text-2xl font-bold mb-8 font-mono">All Ranks - Side by Side</h2>
          <div className="flex items-center justify-center gap-12 p-12 bg-white/5 rounded-lg border border-white/10">
            <GRNDSIcon size={120} />
            <BREAKPOINTIcon size={120} />
            <CHALLENGERIcon size={120} />
            <ABSOLUTEIcon size={120} />
            <XIcon size={120} />
          </div>
        </div>
      </div>
    </div>
  )
}
