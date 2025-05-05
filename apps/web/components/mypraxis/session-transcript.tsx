import { sessionTranscripts } from "../../data/mypraxis/session-transcripts"

interface SessionTranscriptProps {
  clientId: string
  date: string
}

export function SessionTranscript({ clientId, date }: SessionTranscriptProps) {
  // For now, we only have Mike's transcripts
  if (clientId !== "mike" || !sessionTranscripts.mike[date as keyof typeof sessionTranscripts.mike]) {
    return (
      <div className="w-[45%] px-6 pt-6 bg-white">
        <h2 className="text-[24px] font-semibold text-[#111827] tracking-[-0.011em] truncate">
          Session Transcript Not Available
        </h2>
        <div className="mt-5 rounded-lg bg-[#FFF9E8] p-6">
          <p className="text-[#374151] text-[14px] leading-[1.6]">No transcript available for this session.</p>
        </div>
      </div>
    )
  }

  // Since we've already checked that clientId is 'mike' and the date exists
  const transcript = sessionTranscripts.mike[date as keyof typeof sessionTranscripts.mike]

  return (
    <div className="w-[45%] px-6 pt-6 bg-white">
      <div className="space-y-1">
        <h2 className="text-[24px] font-semibold text-[#111827] tracking-[-0.011em] truncate">{transcript.title}</h2>
        <p className="text-[14px] text-[#6B7280]">
          Session #{transcript.number} · {transcript.date}
        </p>
      </div>

      <div className="mt-5 rounded-lg bg-[#FFF9E8] p-6">
        <div className="space-y-4 text-[#374151] text-[14px] leading-[1.6]">
          {transcript.content.map((line: { speaker: string; text: string }, index: number) => (
            <div key={index} className="flex gap-3">
              <span className="font-semibold min-w-[20px]">{line.speaker}:</span>
              <span>{line.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
