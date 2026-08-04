import { ImageResponse } from 'next/og'
export const size = {
  width: 1200,
  height: 600,
}

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0A0A0A 0%, #111111 60%, #1D3461 100%)',
          color: '#FAFAFA',
          padding: '56px',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 22,
              background: 'linear-gradient(135deg, #D4A843 0%, #3B82F6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0A0A0A',
              fontSize: 38,
              fontWeight: 800,
            }}
          >
            M
          </div>
          <div style={{ fontSize: 36, fontWeight: 700 }}>MassiCloud</div>
        </div>
        <div style={{ marginTop: 42, fontSize: 62, fontWeight: 800, lineHeight: 1.08, maxWidth: 960 }}>
          Sovereign cloud infrastructure built for Algeria.
        </div>
      </div>
    ),
    size
  )
}



