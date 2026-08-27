import type { ArchitectureDefinition, ZoneId } from './data';

function zonesForArchitecture(architecture: ArchitectureDefinition) {
  return Array.from(new Set(architecture.nodes.flatMap((node) => node.replicaZones ?? [])));
}

export interface GcpZoneFrame {
  key: string;
  label: string;
  sublabel: string;
  className: string;
  failed?: boolean;
}

export interface GcpRegionFrame {
  key: string;
  label: string;
  sublabel: string;
  className: string;
  zones: GcpZoneFrame[];
  failed?: boolean;
}

export interface GcpTopologyFrame {
  globalLabel: string;
  globalSublabel: string;
  regions: GcpRegionFrame[];
}

export function gcpTopologyFrame(
  architecture: ArchitectureDefinition,
  failedZones: ZoneId[],
  failedRegions: string[],
  pins: string[] = [],
): GcpTopologyFrame {
  if (architecture.id === 'multi_region_saas') {
    return {
      globalLabel: 'Global external Application Load Balancer',
      globalSublabel: 'Cloud Armor · serverless NEGs',
      regions: [
        {
          key: 'europe-west2',
          label: 'europe-west2',
          sublabel: 'Shared VPC · Primary region',
          className: 'gcp-region gcp-region-primary',
          failed: failedRegions.includes('europe-west2'),
          zones: [
            { key: 'europe-west2-a', label: 'europe-west2-a', sublabel: 'Subnet · Zone A', className: 'gcp-zone gcp-zone-a', failed: failedZones.includes('europe-west2-a') },
            { key: 'europe-west2-b', label: 'europe-west2-b', sublabel: 'Subnet · Zone B', className: 'gcp-zone gcp-zone-b', failed: failedZones.includes('europe-west2-b') },
          ],
        },
        {
          key: 'us-east4',
          label: 'us-east4',
          sublabel: pins.includes('no_second_region') ? 'Excluded by human pin' : 'Shared VPC · Secondary region',
          className: 'gcp-region gcp-region-secondary',
          failed: failedRegions.includes('us-east4') || pins.includes('no_second_region'),
          zones: [
            { key: 'us-east4-a', label: 'us-east4-a', sublabel: 'Subnet · Zone A', className: 'gcp-zone gcp-zone-a', failed: failedZones.includes('us-east4-a') || pins.includes('no_second_region') },
            { key: 'us-east4-b', label: 'us-east4-b', sublabel: 'Subnet · Zone B', className: 'gcp-zone gcp-zone-b', failed: failedZones.includes('us-east4-b') || pins.includes('no_second_region') },
          ],
        },
      ],
    };
  }

  const region = architecture.nodes.find((node) => node.region)?.region ?? 'europe-west2';
  const zones = zonesForArchitecture(architecture);
  const [zoneA, zoneB] = zones;

  return {
    globalLabel: architecture.id === 'llm_inference_serving' ? 'External clients · API Gateway' : 'Ingress · Edge tier',
    globalSublabel: 'Global or regional front door',
    regions: [
      {
        key: region,
        label: region,
        sublabel: 'Shared VPC · Regional deployment',
        className: 'gcp-region gcp-region-single',
        failed: failedRegions.includes(region),
        zones: [
          { key: zoneA ?? 'zone-a', label: zoneA ?? 'zone-a', sublabel: 'Subnet · Zone A', className: 'gcp-zone gcp-zone-a', failed: zoneA ? failedZones.includes(zoneA) : false },
          { key: zoneB ?? 'zone-b', label: zoneB ?? 'zone-b', sublabel: 'Subnet · Zone B', className: 'gcp-zone gcp-zone-b', failed: zoneB ? failedZones.includes(zoneB) : false },
        ],
      },
    ],
  };
}
