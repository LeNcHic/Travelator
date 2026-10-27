import { useEffect, useId, useRef, useState } from "react";
import { geoGraticule, geoMercator, geoPath } from "d3-geo";
import type { FeatureCollection } from "geojson";
import geometry from "../data/east-asia.json";
import { cities, ticketById } from "../data/catalog";
import { baseCatalog, countries } from "../data/destination-catalog";
import type { CityId, Mode, RoutePlan } from "../types";

export default function RouteMap({
  ids,
  plan,
  mini = false,
  selected = 0,
  onSelect,
  modes,
}: {
  ids: CityId[];
  plan?: RoutePlan;
  mini?: boolean;
  selected?: number;
  onSelect?: (index: number) => void;
  modes?: Mode[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 380, height: mini ? 270 : 440 });
  const clipId = useId();
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setSize({ width, height });
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const { width, height } = size;
  const points = ids.map((id) => cities[id].point);
  const lon = points.map((p) => p[0]),
    lat = points.map((p) => p[1]);
  const projection = geoMercator()
    .fitExtent(
      [
        [25, 24],
        [width - 25, height - 24],
      ],
      {
        type: "MultiPoint",
        coordinates: [
          [Math.min(...lon) - 4, Math.min(...lat) - 2.6],
          [Math.max(...lon) + 4, Math.max(...lat) + 2.7],
        ],
      },
    )
    .clipExtent([
      [0, 0],
      [width, height],
    ]);
  const path = geoPath(projection);
  const destination = countries[baseCatalog[ids[0]]?.country];
  const country = destination?.map ? projection(destination.map.center) : null;
  // A country without a boundary asset still has a coordinate-based route schematic.
  const features = destination?.id === "CN" ? (geometry as FeatureCollection).features : [];
  return (
    <div
      ref={ref}
      className={`tv-map ${mini ? "tv-mini-map" : ""}`}
      role={mini ? "img" : "group"}
      aria-label={`Карта маршрута: ${ids.map((id) => cities[id].name).join(" → ")}`}
    >
      <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <defs>
          <clipPath id={clipId}>
            <rect width={width} height={height} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          <path
            className="tv-graticule"
            d={path(geoGraticule().step([5, 5])()) ?? ""}
          />
          {features.map((f) => (
            <path
              key={f.properties?.id}
              className={`tv-geo-land ${f.properties?.id === destination?.map?.feature ? "tv-geo-china" : ""}`}
              d={path(f) ?? ""}
            />
          ))}
          {country && country[1] > 20 && country[1] < height - 20 && (
            <text
              x={country[0]}
              y={country[1]}
              textAnchor="middle"
              className="tv-country-label"
            >
              {destination.name.toLocaleUpperCase("ru")}
            </text>
          )}
          {ids.slice(1).map((id, i) => (
            <path
              key={`${ids[i]}-${id}`}
              className={`tv-geo-route ${(modes?.[i] ?? (plan ? ticketById(plan.tickets[i]).mode : "air")) === "air" ? "tv-air-route" : ""}`}
              d={
                path({
                  type: "LineString",
                  coordinates: [cities[ids[i]].point, cities[id].point],
                }) ?? ""
              }
            />
          ))}
        </g>
      </svg>
      {ids.map((id, index) => {
        const [x, y] = projection(cities[id].point)!;
        const labelWidth = cities[id].name.length * 7 + 16;
        const labelLeft = mini
          ? x - labelWidth / 2
          : x + labelWidth + 28 > width
            ? x - labelWidth - 24
            : x + 24;
        return (
          <div key={id}>
            {mini ? (
              <span className="tv-map-pin" style={{ left: x, top: y }}>
                {index + 1}
              </span>
            ) : (
              <button
                type="button"
                className="tv-map-pin"
                style={{ left: x, top: y }}
                aria-pressed={index === selected}
                aria-label={`Показать ${cities[id].name}`}
                onClick={() => onSelect?.(index)}
              >
                {index + 1}
              </button>
            )}
            <span
              className="tv-map-label"
              style={{
                left: Math.max(5, Math.min(width - labelWidth - 5, labelLeft)),
                top: mini ? y + 20 : y - 13,
              }}
            >
              {cities[id].name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
