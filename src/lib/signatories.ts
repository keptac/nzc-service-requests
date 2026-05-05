import { prisma } from "./prisma";

type SignatoryProfile = {
  name: string;
  phonePrimary?: string | null;
  phoneSecondary?: string | null;
  whatsappNumber?: string | null;
};

function profilePhone(profile: SignatoryProfile | null | undefined) {
  return profile?.phonePrimary ?? profile?.phoneSecondary ?? profile?.whatsappNumber ?? null;
}

export function signatoryPreview(profile: SignatoryProfile | null | undefined) {
  if (!profile) return "Not set";
  const phone = profilePhone(profile);
  return phone ? `${profile.name} (${phone})` : profile.name;
}

export async function resolveRequestSignatories(input: {
  requesterId: string;
  districtId: string;
}) {
  const [requester, districtPastors] = await Promise.all([
    prisma.user.findUnique({
      where: { id: input.requesterId },
      select: {
        name: true,
        phonePrimary: true,
        phoneSecondary: true,
        whatsappNumber: true
      }
    }),
    prisma.user.findMany({
      where: {
        active: true,
        districtId: input.districtId,
        role: { name: "District Pastor" }
      },
      orderBy: { name: "asc" },
      select: {
        name: true,
        phonePrimary: true,
        phoneSecondary: true,
        whatsappNumber: true
      }
    })
  ]);

  const districtPastor = districtPastors.find((pastor) => profilePhone(pastor)) ?? districtPastors[0] ?? null;

  return {
    clericalOfficeName: requester?.name ?? null,
    clericalOfficePhone: profilePhone(requester),
    districtPastorName: districtPastor?.name ?? null,
    districtPastorPhone: profilePhone(districtPastor),
    preview: {
      clericalOffice: signatoryPreview(requester),
      districtPastor: signatoryPreview(districtPastor)
    }
  };
}
