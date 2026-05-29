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
Component-scoped selector labels.
*/}}
{{- define "psu-parlay.selectorLabels" -}}
app.kubernetes.io/name: {{ include "psu-parlay.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: {{ . | quote }}
{{- end }}

{{/* Per-component fully qualified names */}}
{{- define "psu-parlay.backend.fullname" -}}
{{- printf "%s-backend" (include "psu-parlay.fullname" .) }}
{{- end }}

{{/*
secretKeyRef blocks for each sensitive value.
Each helper returns the `name` and `key` lines ready to drop under `secretKeyRef:`.
When an existingSecret is supplied the chart-managed secret is bypassed entirely.
*/}}

{{- define "psu-parlay.secretRef.jwtSecret" -}}
{{- if .Values.secrets.existingSecret }}
name: {{ .Values.secrets.existingSecret }}
key: {{ .Values.secrets.existingSecretKey | default "jwt-secret" }}
{{- else }}
name: {{ include "psu-parlay.backend.fullname" . }}-secret
key: JWT_SECRET
{{- end }}
{{- end }}

{{- define "psu-parlay.secretRef.vapidPublicKey" -}}
{{- if .Values.backend.config.vapidExistingSecret }}
name: {{ .Values.backend.config.vapidExistingSecret }}
key: {{ .Values.backend.config.vapidPublicKeyKey | default "vapid-public-key" }}
{{- else }}
name: {{ include "psu-parlay.backend.fullname" . }}-secret
key: VAPID_PUBLIC_KEY
{{- end }}
{{- end }}

{{- define "psu-parlay.secretRef.vapidPrivateKey" -}}
{{- if .Values.backend.config.vapidExistingSecret }}
name: {{ .Values.backend.config.vapidExistingSecret }}
key: {{ .Values.backend.config.vapidPrivateKeyKey | default "vapid-private-key" }}
{{- else }}
name: {{ include "psu-parlay.backend.fullname" . }}-secret
key: VAPID_PRIVATE_KEY
{{- end }}
{{- end }}

{{- define "psu-parlay.secretRef.oddsApiKey" -}}
{{- if .Values.backend.config.oddsApiExistingSecret }}
name: {{ .Values.backend.config.oddsApiExistingSecret }}
key: {{ .Values.backend.config.oddsApiExistingSecretKey | default "odds-api-key" }}
{{- else }}
name: {{ include "psu-parlay.backend.fullname" . }}-secret
key: ODDS_API_KEY
{{- end }}
{{- end }}

{{/*
Resolve the CORS origin the backend will trust.
  - Ingress: derived from ingress.host + tls presence
  - HTTPRoute: derived from first httproute.hostname (always https)
  - NodePort / fallback: http://$(NODE_IP):<nodePort> — Kubernetes resolves
    the $(NODE_IP) substitution at pod start from the NODE_IP env var
    injected via the Downward API.
*/}}
{{- define "psu-parlay.corsOrigin" -}}
{{- if .Values.ingress.enabled }}
{{- $scheme := "http" }}
{{- if .Values.ingress.tls }}{{- $scheme = "https" }}{{- end }}
{{- printf "%s://%s" $scheme .Values.ingress.host }}
{{- else if .Values.httproute.enabled }}
{{- printf "https://%s" (first .Values.httproute.hostnames) }}
{{- else }}
{{- printf "http://$(NODE_IP):%v" .Values.backend.service.nodePort }}
{{- end }}
{{- end }}

