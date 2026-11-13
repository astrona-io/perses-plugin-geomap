package model

import (
	"github.com/perses/shared/cue/common"
)

kind: "GeoMapChart"
spec: close({
	// How each series is reduced to one value (last, sum, mean, ...).
	calculation: common.#calculation
	// Series label holding the ISO 3166-1 alpha-2 country code.
	countryLabel?: string & =~"^[a-zA-Z_][a-zA-Z0-9_]*$"
	format?:       common.#format
	colorScheme?:  "blues" | "greens" | "oranges" | "purples" | "reds" | "viridis"
	scale?:        "linear" | "log"
	min?:          number
	max?:          number
	showLegend?:   bool
	// Mouse-wheel / pinch zoom, drag to pan and the zoom buttons. Default true.
	zoom?: bool
	// Click a country to zoom to it; click it again or the sea to zoom out. Default true.
	clickToZoom?: bool
	// Labels of series drawn as points (cities). Coordinates are decimal degrees.
	cityLabel?:      string & =~"^[a-zA-Z_][a-zA-Z0-9_]*$"
	latitudeLabel?:  string & =~"^[a-zA-Z_][a-zA-Z0-9_]*$"
	longitudeLabel?: string & =~"^[a-zA-Z_][a-zA-Z0-9_]*$"
	// When points are drawn: auto (once zoomed in, or when there are only points), always, never.
	showCities?: "auto" | "always" | "never"
})
