import type { ArchitectureDefinition, ZoneId } from './data';
import { topologyGrids, type TopologyLane } from './topology-layout';

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
  layout: 'regional' | 'pair';
  globalLabel: string;
  globalSublabel: string;
  lanes: TopologyLane[];
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
      layout: 'pair',
      globalLabel: 'Global external Application Load Balancer',
      globalSublabel: 'Cloud Armor · serverless NEGs',
      lanes: topologyGrids.multi_region_saas.lanes,
      regions: [
        {
          key: 'europe-west2',
          label: 'europe-west2',
          sublabel: 'Shared VPC · Primary region',
          className: 'gcp-region gcp-region-primary',
          failed: failedRegions.includes('europe-west2'),
          zones: [
            { key: 'europe-west2-a', label: 'AZ A', sublabel: 'europe-west2-a', className: 'gcp-zone-chip gcp-zone-a', failed: failedZones.includes('europe-west2-a') },
            { key: 'europe-west2-b', label: 'AZ B', sublabel: 'europe-west2-b', className: 'gcp-zone-chip gcp-zone-b', failed: failedZones.includes('europe-west2-b') },
          ],
        },
        {
          key: 'us-east4',
          label: 'us-east4',
          sublabel: pins.includes('no_second_region') ? 'Excluded by human pin' : 'Shared VPC · Secondary region',
          className: 'gcp-region gcp-region-secondary',
          failed: failedRegions.includes('us-east4') || pins.includes('no_second_region'),
          zones: [
            { key: 'us-east4-a', label: 'AZ A', sublabel: 'us-east4-a', className: 'gcp-zone-chip gcp-zone-a', failed: failedZones.includes('us-east4-a') || pins.includes('no_second_region') },
            { key: 'us-east4-b', label: 'AZ B', sublabel: 'us-east4-b', className: 'gcp-zone-chip gcp-zone-b', failed: failedZones.includes('us-east4-b') || pins.includes('no_second_region') },
          ],
        },
      ],
    };
  }

  const region = architecture.nodes.find((node) => node.region)?.region ?? 'europe-west2';
  const zones = zonesForArchitecture(architecture);
  const [zoneA, zoneB] = zones;

  return {
    layout: 'regional',
    globalLabel: architecture.id === 'llm_inference_serving' ? 'External clients · API Gateway' : 'Ingress · Edge tier',
    globalSublabel: 'Global or regional front door',
    lanes: topologyGrids[architecture.id].lanes,
    regions: [
      {
        key: region,
        label: region,
        sublabel: 'Shared VPC · Regional deployment',
        className: 'gcp-region gcp-region-single',
        failed: failedRegions.includes(region),
        zones: [
          { key: zoneA ?? 'zone-a', label: 'AZ A', sublabel: zoneA ?? 'zone-a', className: 'gcp-zone-chip gcp-zone-a', failed: zoneA ? failedZones.includes(zoneA) : false },
          { key: zoneB ?? 'zone-b', label: 'AZ B', sublabel: zoneB ?? 'zone-b', className: 'gcp-zone-chip gcp-zone-b', failed: zoneB ? failedZones.includes(zoneB) : false },
        ],
      },
    ],
  };
}
