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
})
