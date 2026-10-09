import { memo } from 'react';
import { CELL, GRID_X, GRID_Y, LEVELS, makeLevel, WIDTH } from './game/levels';

// Reuse the actual game generator; previews cannot drift from the playable maps.
const previews = LEVELS.map((_, index) => {
  const bricks = makeLevel(index);
  const path = (hp: number) => bricks.filter(brick => brick.hp === hp).map(brick =>
    `M${GRID_X + brick.col * CELL + 0.7},${GRID_Y + brick.row * CELL + 0.7}h8.6v8.6h-8.6z`).join('');
  return { green: path(1), grey: path(10) };
});

export const MapPreview = memo(function MapPreview({ index }: { index: number }) {
  const map = previews[index];
  return <svg className="map-preview" viewBox={`0 0 ${WIDTH} 480`} aria-hidden="true">
    <rect width={WIDTH} height="480" rx="12" fill="#080f20"/>
    <path d={map.grey} fill="#78879a"/>
    <path d={map.green} fill="#b4ed7b"/>
    <rect x="174" y="461" width="72" height="5" rx="2.5" fill="#b8a2f0"/>
    <circle cx="210" cy="454" r="3" fill="#eef7ff"/>
  </svg>;
});
