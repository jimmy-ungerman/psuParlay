{{/*
Expand the name of the chart.
*/}}
{{- define "psu-parlay.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "psu-parlay.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Chart label.
*/}}
{{- define "psu-parlay.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels applied to every resource.
*/}}
{{- define "psu-parlay.labels" -}}
helm.sh/chart: {{ include "psu-parlay.chart" . }}
app.kubernetes.io/name: {{ include "psu-parlay.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Fully qualified name for the app.
*/}}
{{- define "psu-parlay.app.fullname" -}}
{{- printf "%s-app" (include "psu-parlay.fullname" .) }}
{{- end }}

{{/*
Resolve the CORS origin.
  - HTTPRoute: derived from first httproute.hostname (always https)
  - NodePort / fallback: http://$(NODE_IP):<nodePort>
*/}}
{{- define "psu-parlay.corsOrigin" -}} }}
{{- if .Values.httproute.enabled }}
{{- printf "https://%s" (first .Values.httproute.hostnames) }}
{{- else }}
{{- printf "http://$(NODE_IP):%v" .Values.app.service.nodePort }}
{{- end }}
{{- end }}
