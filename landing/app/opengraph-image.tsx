import { ImageResponse } from 'next/og'
export const alt = 'MassiCloud — Sovereign developer platform for Algeria'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#0A0A0A',
          backgroundImage:
            'radial-gradient(circle at top left, rgba(59,130,246,0.22), transparent 35%), radial-gradient(circle at 80% 20%, rgba(212,168,67,0.2), transparent 30%)',
          color: '#FAFAFA',
          padding: '56px',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              width: 68,
              height: 68,
              borderRadius: 20,
              background: 'linear-gradient(135deg, #D4A843 0%, #3B82F6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0A0A0A',
              fontSize: 34,
              fontWeight: 800,
            }}
          >
            M
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 34, fontWeight: 700 }}>MassiCloud</div>
            <div style={{ fontSize: 22, color: '#D4A843' }}>CLOUD SOUVERAIN ALGÉRIEN</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 900 }}>
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.05 }}>
            The sovereign developer platform for Algeria.
          </div>
          <div style={{ fontSize: 30, lineHeight: 1.4, color: '#D4D4D8' }}>
            Managed Postgres, Redis, object storage, and compliance-first infrastructure built for Algerian law.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 18, fontSize: 24, color: '#A1A1AA' }}>
          <div>Postgres + Redis managés</div>
          <div>•</div>
          <div>Stockage compatible S3</div>
          <div>•</div>
          <div>Lois 18-07 & 25-11</div>
        </div>
      </div>
    ),
    size
  )
}



