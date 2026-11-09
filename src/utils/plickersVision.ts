import jsQR from 'jsqr';

export interface DetectedCardResult {
  cardId: number;
  rawPayload: string;
  studentCode?: string;
  examId?: string;
  answer: 'A' | 'B' | 'C' | 'D';
  rotationDeg: number;
  confidence: number;
  location: {
    topLeft: { x: number; y: number };
    topRight: { x: number; y: number };
    bottomRight: { x: number; y: number };
    bottomLeft: { x: number; y: number };
    center: { x: number; y: number };
    topMidpoint: { x: number; y: number };
  };
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  timestamp: number;
}

/**
 * Parse card payload into Card ID, Student Code, Exam ID.
 * Supports standard formats:
 * - EDUTEST-QR:EXAM=xxx:STUDENT=HS01:CARD=12
 * - PLICKERS:12:HS01
 * - CARD:12
 * - EDUTEST-CARD-12
 * - Raw integers: "12"
 */
export function parseCardPayload(data: string): { cardId: number; studentCode?: string; examId?: string } | null {
  if (!data || typeof data !== 'string') return null;

  const trimmed = data.trim();

  // Format 1: EDUTEST-QR:EXAM=...:STUDENT=...:CARD=...
  if (trimmed.includes('CARD=')) {
    const cardMatch = trimmed.match(/CARD=(\d+)/i);
    const studentMatch = trimmed.match(/STUDENT=([^:]+)/i);
    const examMatch = trimmed.match(/EXAM=([^:]+)/i);

    if (cardMatch) {
      const cardId = parseInt(cardMatch[1], 10);
      return {
        cardId,
        studentCode: studentMatch ? studentMatch[1].trim() : undefined,
        examId: examMatch ? examMatch[1].trim() : undefined
      };
    }
  }

  // Format 2: PLICKERS:cardId:studentCode
  if (trimmed.startsWith('PLICKERS:')) {
    const parts = trimmed.split(':');
    const cardId = parseInt(parts[1], 10);
    if (!isNaN(cardId) && cardId > 0) {
      return {
        cardId,
        studentCode: parts[2]?.trim(),
        examId: parts[3]?.trim()
      };
    }
  }

  // Format 3: CARD:cardId or EDUTEST-CARD-cardId
  const prefixMatch = trimmed.match(/CARD[-:](\d+)/i);
  if (prefixMatch) {
    const cardId = parseInt(prefixMatch[1], 10);
    if (!isNaN(cardId) && cardId > 0) {
      return { cardId };
    }
  }

  // Format 4: Raw integer
  const numOnly = parseInt(trimmed, 10);
  if (!isNaN(numOnly) && numOnly > 0 && numOnly <= 200) {
    return { cardId: numOnly };
  }

  return null;
}

/**
 * Analyze QR code corner coordinates and calculate orientation angle
 * to determine which edge (A, B, C, or D) is facing UP (towards the camera ceiling).
 * 
 * Card Design Geometry:
 * - Edge A: Top of QR code (between topLeft and topRight)
 * - Edge B: Right of QR code (between topRight and bottomRight)
 * - Edge C: Bottom of QR code (between bottomRight and bottomLeft)
 * - Edge D: Left of QR code (between bottomLeft and topLeft)
 * 
 * In camera pixel coordinates:
 * - +X is Right
 * - +Y is Down (Floor)
 * - -Y is Up (Ceiling)
 */
export function determineCardOrientation(loc: {
  topLeftCorner: { x: number; y: number };
  topRightCorner: { x: number; y: number };
  bottomRightCorner: { x: number; y: number };
  bottomLeftCorner: { x: number; y: number };
}): {
  answer: 'A' | 'B' | 'C' | 'D';
  rotationDeg: number;
  confidence: number;
  center: { x: number; y: number };
  topMidpoint: { x: number; y: number };
} {
  const tl = loc.topLeftCorner;
  const tr = loc.topRightCorner;
  const br = loc.bottomRightCorner;
  const bl = loc.bottomLeftCorner;

  // Center of QR
  const cx = (tl.x + tr.x + br.x + bl.x) / 4;
  const cy = (tl.y + tr.y + br.y + bl.y) / 4;

  // Top midpoint of QR (intrinsic Top = Edge A)
  const mx = (tl.x + tr.x) / 2;
  const my = (tl.y + tr.y) / 2;

  // Vector from Center towards QR's intrinsic Top (Edge A)
  const dx = mx - cx;
  const dy = my - cy;

  // Angle in degrees: -180 to +180
  // In pixel coords:
  // (0, -1) [Ceiling/Up] => -90 deg
  // (1, 0)  [Right]      => 0 deg
  // (0, 1)  [Floor/Down] => +90 deg
  // (-1, 0) [Left]       => 180 / -180 deg
  const rad = Math.atan2(dy, dx);
  let deg = (rad * 180) / Math.PI;

  let answer: 'A' | 'B' | 'C' | 'D' = 'A';
  let idealAngle = -90;

  if (Math.abs(dy) >= Math.abs(dx)) {
    if (dy < 0) {
      // Intrinsic Top (A) is pointing UP towards camera ceiling
      answer = 'A';
      idealAngle = -90;
    } else {
      // Intrinsic Top (A) is pointing DOWN towards floor => Edge C is at the TOP
      answer = 'C';
      idealAngle = 90;
    }
  } else {
    if (dx < 0) {
      // Intrinsic Top (A) is pointing LEFT => Edge B (Right edge) has rotated to the TOP
      answer = 'B';
      idealAngle = deg < 0 ? -180 : 180;
    } else {
      // Intrinsic Top (A) is pointing RIGHT => Edge D (Left edge) has rotated to the TOP
      answer = 'D';
      idealAngle = 0;
    }
  }

  // Calculate confidence based on angle deviation from principal axis
  let diff = Math.abs(deg - idealAngle);
  if (diff > 180) diff = 360 - diff;
  // Maximum deviation inside the quadrant is 45 degrees.
  const angleConfidence = Math.max(0.5, Math.min(1.0, 1 - (diff / 60)));

  // Bounding box size confidence (must be larger than minimum readable resolution)
  const sideLength = Math.hypot(tr.x - tl.x, tr.y - tl.y);
  const sizeConfidence = Math.min(1.0, sideLength / 50);

  const confidence = Math.round((angleConfidence * 0.7 + sizeConfidence * 0.3) * 100) / 100;

  return {
    answer,
    rotationDeg: Math.round(deg),
    confidence,
    center: { x: cx, y: cy },
    topMidpoint: { x: mx, y: my }
  };
}

/**
 * Multi-QR Detection Engine in a single video frame.
 * Iteratively detects codes and masks their pixels to unearth other QR codes in the same frame.
 */
export function detectMultipleCardsFromCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  maxCards: number = 8
): DetectedCardResult[] {
  const results: DetectedCardResult[] = [];
  const imgData = ctx.getImageData(0, 0, width, height);
  const pixelData = imgData.data;

  for (let iteration = 0; iteration < maxCards; iteration++) {
    const code = jsQR(pixelData, width, height, {
      inversionAttempts: 'dontInvert'
    });

    if (!code || !code.data || !code.location) {
      break;
    }

    const payloadInfo = parseCardPayload(code.data);
    if (payloadInfo) {
      const orientation = determineCardOrientation(code.location);

      // Check if this card ID has already been detected in this frame
      if (!results.some(r => r.cardId === payloadInfo.cardId)) {
        const xs = [
          code.location.topLeftCorner.x,
          code.location.topRightCorner.x,
          code.location.bottomRightCorner.x,
          code.location.bottomLeftCorner.x
        ];
        const ys = [
          code.location.topLeftCorner.y,
          code.location.topRightCorner.y,
          code.location.bottomRightCorner.y,
          code.location.bottomLeftCorner.y
        ];

        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        results.push({
          cardId: payloadInfo.cardId,
          rawPayload: code.data,
          studentCode: payloadInfo.studentCode,
          examId: payloadInfo.examId,
          answer: orientation.answer,
          rotationDeg: orientation.rotationDeg,
          confidence: orientation.confidence,
          location: {
            topLeft: code.location.topLeftCorner,
            topRight: code.location.topRightCorner,
            bottomRight: code.location.bottomRightCorner,
            bottomLeft: code.location.bottomLeftCorner,
            center: orientation.center,
            topMidpoint: orientation.topMidpoint
          },
          bounds: {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
          },
          timestamp: Date.now()
        });
      }
    }

    // Mask the detected QR code region with white pixels to allow finding the next code
    const loc = code.location;
    const pad = 6;
    const minX = Math.max(0, Math.floor(Math.min(loc.topLeftCorner.x, loc.topRightCorner.x, loc.bottomRightCorner.x, loc.bottomLeftCorner.x) - pad));
    const maxX = Math.min(width - 1, Math.ceil(Math.max(loc.topLeftCorner.x, loc.topRightCorner.x, loc.bottomRightCorner.x, loc.bottomLeftCorner.x) + pad));
    const minY = Math.max(0, Math.floor(Math.min(loc.topLeftCorner.y, loc.topRightCorner.y, loc.bottomRightCorner.y, loc.bottomLeftCorner.y) - pad));
    const maxY = Math.min(height - 1, Math.ceil(Math.max(loc.topLeftCorner.y, loc.topRightCorner.y, loc.bottomRightCorner.y, loc.bottomLeftCorner.y) + pad));

    for (let y = minY; y <= maxY; y++) {
      const rowOffset = y * width;
      for (let x = minX; x <= maxX; x++) {
        const idx = (rowOffset + x) * 4;
        pixelData[idx] = 255;     // R
        pixelData[idx + 1] = 255; // G
        pixelData[idx + 2] = 255; // B
        // Alpha unchanged
      }
    }
  }

  return results;
}

/**
 * Draw real-time visual tracking overlays on canvas:
 * - Card bounding polygon
 * - Orientation direction indicator
 * - Floating status badge with Card #, Student Name, Answer Letter
 */
export function drawCardVisualOverlay(
  ctx: CanvasRenderingContext2D,
  card: DetectedCardResult,
  studentName?: string,
  options?: {
    isCorrect?: boolean;
    showAnswerStatus?: boolean; // If true, shows green/red; if false, shows neutral blue
    isSelected?: boolean;
  }
) {
  const { isCorrect, showAnswerStatus = false } = options || {};
  const { topLeft, topRight, bottomRight, bottomLeft, center, topMidpoint } = card.location;

  // Determine theme colors based on state
  let strokeColor = '#06b6d4'; // Cyan by default
  let fillColor = 'rgba(6, 182, 212, 0.18)';
  let badgeBg = '#0e7490';

  if (showAnswerStatus) {
    if (isCorrect) {
      strokeColor = '#10b981'; // Emerald Green
      fillColor = 'rgba(16, 185, 129, 0.22)';
      badgeBg = '#059669';
    } else {
      strokeColor = '#f43f5e'; // Rose Red
      fillColor = 'rgba(244, 63, 94, 0.22)';
      badgeBg = '#e11d48';
    }
  } else {
    // Neutral recorded response: Amber / Indigo
    strokeColor = '#6366f1'; // Indigo
    fillColor = 'rgba(99, 102, 241, 0.20)';
    badgeBg = '#4f46e5';
  }

  ctx.save();

  // 1. Draw polygon boundary around card
  ctx.beginPath();
  ctx.moveTo(topLeft.x, topLeft.y);
  ctx.lineTo(topRight.x, topRight.y);
  ctx.lineTo(bottomRight.x, bottomRight.y);
  ctx.lineTo(bottomLeft.x, bottomLeft.y);
  ctx.closePath();

  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 3;
  ctx.stroke();

  // 2. Draw Top Edge Indicator (Direction marker)
  ctx.beginPath();
  ctx.moveTo(topLeft.x, topLeft.y);
  ctx.lineTo(topRight.x, topRight.y);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.stroke();

  // 3. Draw orientation arrow from center towards top
  ctx.beginPath();
  ctx.moveTo(center.x, center.y);
  ctx.lineTo(topMidpoint.x, topMidpoint.y);
  ctx.strokeStyle = '#fbbf24'; // Amber arrow
  ctx.lineWidth = 3;
  ctx.stroke();

  // 4. Draw Floating Badge on top of card
  const badgeX = center.x;
  const badgeY = Math.min(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y) - 18;

  const displayName = studentName || `Học sinh #${card.cardId}`;
  const textLabel = `#${card.cardId} ${displayName} [${card.answer}]`;

  ctx.font = 'bold 13px Segoe UI, system-ui, sans-serif';
  const textWidth = ctx.measureText(textLabel).width;
  const boxWidth = textWidth + 24;
  const boxHeight = 26;

  // Background pill
  ctx.fillStyle = badgeBg;
  ctx.beginPath();
  ctx.roundRect(badgeX - boxWidth / 2, badgeY - boxHeight / 2, boxWidth, boxHeight, 13);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Answer badge letter
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(textLabel, badgeX, badgeY);

  ctx.restore();
}
