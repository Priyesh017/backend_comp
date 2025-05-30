import Bcrypt from "bcryptjs";
import { Request, Response } from "express";
import { prisma } from "../client.js";
import { generateSecurePassword, getNextId, MarksheetData } from "../helper.js";
import {
  sendPasswordResetEmail,
  sendTemporaryPasswordEmail,
} from "../emailHelper.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { redisClient } from "../index.js";
import logger from "../logger.js";
import { z } from "zod";
import { fillId } from "../Generetor/id.js";
import { filladmit } from "../Generetor/admit.js";
import { fillCertificate } from "../Generetor/certificate.js";
import { fillMarksheet } from "../Generetor/marksheet.js";

export async function createEnrollment(req: Request, res: Response) {
  const {
    name,
    dob,
    father,
    mother,
    address,
    mobile: mobileNo,
    email,
    eduqualification,
    courseid,
    imageUrl,
    category,
    nationality,
    idtype,
    idProofNo,
    sex,
    pincode,
    vill,
    dist,
    po,
    ps,
    state,
    createdAt,
  } = req.body;

  const dobUpdated = new Date(dob);
  const centerid = Number(req.centerId); //already number ache
  const updatedCreatedAt =
    createdAt == "" ? new Date(Date.now()) : new Date(createdAt);

  const result = await prisma.$transaction(async (tx) => {
    const EnrollmentNo = await getNextId(tx, "EnrollmentNo");
    const IdCardNo = await getNextId(tx, "IdCardNo");
    const CertificateNo = await getNextId(tx, "CertificateNo");

    return await tx.enrollment.create({
      data: {
        father,
        EnrollmentNo,
        IdCardNo,
        CertificateNo,
        category,
        nationality,
        mobileNo,
        idProof: idtype,
        idProofNo,
        mother,
        pincode,
        address,
        dist,
        pin: pincode,
        po,
        ps,
        state,
        vill,
        status: {
          id: 1,
          val: "pending",
        },
        dob: dobUpdated,
        name,
        email,
        sex,
        course: {
          connect: {
            id: parseInt(courseid),
          },
        },
        eduqualification,
        center: {
          connect: { code: centerid },
        },
        imageLink: imageUrl,
        createdAt: updatedCreatedAt,
      },
    });
  });

  res.json({ success: true, EnrollmentNo: result.EnrollmentNo });
}

export async function ActivateEnrollment(req: Request, res: Response) {
  //check
  const { EnrollmentNo } = req.body;
  await prisma.enrollment.update({
    where: {
      EnrollmentNo,
    },
    data: {
      activated: true,
      status: {
        id: 2,
        val: "Enrollment Verified",
      },
    },
  });

  res.json({ success: true });
}
export async function updateEnrollment(req: Request, res: Response) {
  //check
  const { EnrollmentNo, name, dob, father, address } = req.body;

  const data = await prisma.enrollment.update({
    where: {
      EnrollmentNo: Number(EnrollmentNo),
    },
    data: {
      name,
      dob: new Date(dob),
      father,
      address,
    },
  });

  res.json({ success: true, data });
}
export async function deActivateEnrollment(req: Request, res: Response) {
  //check
  const { EnrollmentNo } = req.body;
  await prisma.enrollment.update({
    where: {
      EnrollmentNo,
    },
    data: {
      activated: false,
    },
  });

  res.json({ success: true });
}

export async function AllEnrollments(req: Request, res: Response) {
  //check
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const enrollments = await prisma.enrollment.findMany({
    skip,
    take: limit,
    where:
      req.Role === "CENTER"
        ? { centerid: Number(req.centerId), isdeleted: false }
        : { isdeleted: false },
    select: {
      admitLink: true,
      certificateLink: true,
      imageLink: true,
      idCardLink: true,
      marksheetLink: true,
      dob: true,
      name: true,
      father: true,
      course: {
        select: {
          CName: true,
          Duration: true,
        },
      },
      createdAt: true,
      EnrollmentNo: true,
      status: true,
      address: true,
      centerid: true,

      activated: true, // Ensure activated field is included
    },
  });

  const total = await prisma.enrollment.count(); // Get total count for pagination
  res.json({ enrollments, total });
}

export async function deleteEnquiry(req: Request, res: Response) {
  const { id } = req.body;

  await prisma.enquiry.update({
    where: {
      id,
    },
    data: {
      isdeleted: true,
    },
  });

  res.json({ success: true });
}
export async function generateCertificate(req: Request, res: Response) {
  const link = await fillCertificate(req.body.data);
  if (link == undefined) return;

  await prisma.enrollment.update({
    where: {
      EnrollmentNo: parseInt(req.body.data.EnrollmentNo),
    },
    data: {
      certificateLink: link,
      status: {
        id: 5,
        val: "passout",
      },
    },
  });
  res.json({ success: true });
}

export async function generateadmit(req: Request, res: Response) {
  const link = await filladmit(req.body.enrollment);

  await prisma.enrollment.update({
    where: {
      EnrollmentNo: parseInt(req.body.enrollment.EnrollmentNo),
    },
    data: {
      admitLink: link,
    },
  });
  res.json({ success: true });
}

export const generateIdSchema = z.object({
  EnrollmentNo: z
    .number()
    .int("Enrollment No must be Integer")
    .positive("Enrollment No must be Positive")
    .lte(999999, "Enrollment No is too large"),
});

export async function Delete_Enrollment(req: Request, res: Response) {
  const { EnrollmentNo } = req.body;

  await prisma.enrollment.update({
    where: {
      EnrollmentNo,
    },
    data: {
      isdeleted: true,
    },
  });

  res.json({ success: true });
}

export async function generateId(req: Request, res: Response) {
  const isvalidated = generateIdSchema.safeParse(req.body);

  if (!isvalidated.success) {
    res.status(400).json({ message: "failed to parse" });
    return;
  }

  const { EnrollmentNo } = isvalidated.data;

  const data = await prisma.enrollment.findFirst({
    where: {
      EnrollmentNo,
    },
    select: {
      address: true,
      mobileNo: true,
      imageLink: true,
      center: {
        select: {
          Centername: true,
          code: true,
        },
      },
      IdCardNo: true,
      EnrollmentNo: true,
      name: true,
      course: {
        select: {
          CName: true,
        },
      },
    },
  });

  if (!data) {
    res.json({ success: false });
    return;
  }

  const link = await fillId(data);

  await prisma.enrollment.update({
    where: {
      EnrollmentNo: data.EnrollmentNo,
    },
    data: {
      idCardLink: link,
    },
  });
  res.json({ success: true });
}

export async function generateMarksheet(req: Request, res: Response) {
  const data = req.body.data as MarksheetData;

  if (!data) {
    res.json({ success: false });
    return;
  }

  const link = await fillMarksheet(data);

  await prisma.enrollment.update({
    where: {
      EnrollmentNo: data.EnrollmentNo,
    },
    data: {
      marksheetLink: link,
    },
  });

  res.json({ success: true });
}

export async function exmformfillupDatafetch(req: Request, res: Response) {
  // branch admin korbe
  const { EnrollmentNo } = req.body;
  const centerid = req.centerId;

  const data = await prisma.enrollment.findFirst({
    where: {
      EnrollmentNo: parseInt(EnrollmentNo),
      centerid,
    },
    select: {
      name: true,
      father: true,
      dob: true,
      IdCardNo: true,
      email: true,
      mobileNo: true,
      address: true,
      activated: true,
      center: {
        select: {
          Centername: true,
          address: true,
        },
      },
      examformFillup: {
        select: {
          verified: true,
        },
      },
      course: {
        select: {
          CName: true,
          subjects: true,
        },
      },
    },
  });

  res.json({ success: true, data });
}

export async function createCourse(req: Request, res: Response) {
  const {
    form: { courseName, duration, price },
  } = req.body;

  await prisma.course.create({
    data: {
      Duration: parseInt(duration),
      CName: courseName,
      price: parseInt(price),
    },
  });
  await redisClient.del("allcourses");
  res.json({ success: true });
}

export async function fetchAllCourse(req: Request, res: Response) {
  const rawCourses = await redisClient.get("allcourses");

  if (rawCourses) {
    res.json(JSON.parse(rawCourses));
    return;
  }

  const courses = await prisma.course.findMany({});
  await redisClient.set("allcourses", JSON.stringify(courses));

  res.json(courses);
}
export async function updateCourse(req: Request, res: Response) {
  const { id, CName, price, Duration } = req.body;

  await prisma.course.update({
    where: {
      id,
    },
    data: {
      Duration: parseInt(Duration),
      CName,
      price: parseInt(price),
    },
  });
  await redisClient.del("allcourses");

  res.json({ success: true });
}

export async function exmformApprove(req: Request, res: Response) {
  const { id } = req.body;

  const data = await prisma.examForm.update({
    where: {
      id,
    },
    data: {
      verified: true,
      enrollment: {
        update: {
          status: {
            id: 3,
            val: "Exam Form Approved",
          },
        },
      },
    },
  });

  res.json({ success: true });
}

export async function exmformDisApprove(req: Request, res: Response) {
  const { id } = req.body;

  const data = await prisma.examForm.update({
    where: {
      id,
    },
    data: {
      verified: false,
    },
  });

  res.json({ success: true });
}

export async function exmmarksApprove(req: Request, res: Response) {
  const { id } = req.body;

  const data = await prisma.marks.update({
    where: {
      id,
    },
    data: {
      verified: true,
      enrollment: {
        update: {
          status: {
            id: 4,
            val: "marksheet approved",
          },
        },
      },
    },
  });

  res.json({ success: true });
}
export async function exmmarksDisApprove(req: Request, res: Response) {
  const { id } = req.body;

  const data = await prisma.marks.update({
    where: {
      id,
    },
    data: {
      verified: false,
    },
  });

  res.json({ success: true });
}
export async function exmmarksentry(req: Request, res: Response) {
  const {
    EnrollmentNo,
    marks,
    remarks,
    grade,
    percentage,
    totalMarks,
    year,
    dop,
  } = req.body;
  const p = parseFloat(percentage);
  const tm = parseFloat(totalMarks);
  const updateddop = new Date(dop);

  await prisma.marks.create({
    data: {
      EnrollmentNo: parseInt(EnrollmentNo),
      marks,
      remarks,
      grade,
      percentage: p,
      totalMarks: tm,
      year,
      createdAt: updateddop,
    },
  });

  res.json({ success: true });
}

export async function exmformsfetch(req: Request, res: Response) {
  //FIXME
  const data = await prisma.examForm.findMany({
    where: {},
    include: {
      enrollment: {
        select: {
          name: true,
          mobileNo: true,
          email: true,
          EnrollmentNo: true,
          imageLink: true,
          address: true,
          father: true,
          centerid: true,

          status: true,
          IdCardNo: true,
          amount: {
            select: {
              lastPaymentRecieptno: true,
            },
          },
          course: {
            select: {
              CName: true,
              Duration: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  res.json(data);
}

export async function marksheetfetch(req: Request, res: Response) {
  const data = await prisma.marks.findMany({
    where: {},
    include: {
      enrollment: {
        // First include enrollment
        select: {
          name: true,
          father: true,
          dob: true,
          imageLink: true,
          CertificateNo: true,
          course: {
            select: {
              CName: true,
              Duration: true,
            },
          },
          center: {
            select: {
              Centername: true,
              code: true,
              address: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  res.json({ success: true, data });
}

export async function TakeEnquiry(req: Request, res: Response) {
  const {
    name,
    email,
    father,
    dob,
    sex,
    category,
    nationality,
    mobileNo,
    AddressLine,
    vill,
    po,
    ps,
    pin,
    eduqualification,
    dist,
    coName,
    state,
    idProof,
    idProofNo,
    houseRoomNo,
    squareFit,
    tradeLicense,
    bathroom,
  } = req.body;
  const Links = req.body.Links as {
    url: string;
    catg: "profile" | "signature";
  }[];

  const bathroomValue = bathroom == "Yes" ? true : false;
  const dobUpdated = new Date(dob);

  const sx = sex.toUpperCase();
  const nt = nationality.toUpperCase();

  const signatureLink = Links.find((elem) => elem.catg === "signature")
    ?.url as string;
  const ImageLink = Links.find((elem) => elem.catg === "profile")
    ?.url as string;

  await prisma.$transaction(async (tx) => {
    const id = await getNextId(tx, "EnquiryId");
    await tx.enquiry.create({
      data: {
        id,
        coName,
        vill,
        po,
        pin,
        ps,
        dist,
        state,
        email,
        father,
        dob: dobUpdated,
        sex: sx,
        category,
        nationality: nt,
        mobileNo,
        AddressLine,
        name,
        eduqualification,
        idProof,
        idProofNo,
        houseRoomNo,
        squareFit,
        tradeLicense,
        bathroom: bathroomValue,
        signatureLink,
        ImageLink,
      },
    });
  });

  res.json({ success: true });
}
export async function FetchAllEnquiry(req: Request, res: Response) {
  const data = await prisma.enquiry.findMany({
    where: {
      isdeleted: false,
    },
  });

  res.json({ data });
}

export async function examFormFillup(req: Request, res: Response) {
  const { EnrollmentNo, ATI_CODE, ExamCenterCode, lastpaymentR } = req.body;

  await prisma.$transaction([
    prisma.amount.update({
      where: {
        EnrollmentNo: parseInt(EnrollmentNo),
      },
      data: {
        lastPaymentRecieptno: lastpaymentR,
      },
    }),
    prisma.examForm.create({
      data: {
        EnrollmentNo: parseInt(EnrollmentNo),
        ATI_CODE,
        ExamCenterCode,
      },
    }),
  ]);
  res.json({ success: true });
}

export async function amountFetch(req: Request, res: Response) {
  const id = Number(req.centerId);

  const data = await prisma.enrollment.findMany({
    where: {
      centerid: id,
      isdeleted: false,
    },
    select: {
      name: true,
      EnrollmentNo: true,

      amount: {
        select: {
          amountRemain: true,
          TotalPaid: true,
        },
      },
      course: {
        select: {
          price: true,
          CName: true,
          Duration: true,
        },
      },
    },
  });

  res.json({ success: true, data });
}

export async function amountEdit(req: Request, res: Response) {
  const { EnrollmentNo, tp, ar } = req.body;
  const TotalPaid = parseInt(tp);
  const amountRemain = parseInt(ar);
  const updatedEnroll = parseInt(EnrollmentNo);

  await prisma.amount.upsert({
    where: {
      EnrollmentNo: updatedEnroll,
    },
    create: {
      TotalPaid,
      amountRemain,
      enrollment: {
        connect: {
          EnrollmentNo: updatedEnroll,
        },
      },
    },
    update: {
      TotalPaid: {
        increment: TotalPaid,
      },
      amountRemain,
    },
  });

  res.json({ success: true });
}

export async function VerifyEnquiry(req: Request, res: Response) {
  //ekta center create hobe and admin assign hobe

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const name = req.query.name as string;
  const email = req.query.email as string;

  function sendUpdate(step: number, message: string) {
    res.write(`data: ${JSON.stringify({ step, message })}\n\n`);
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        email,
      },
    });

    if (user) {
      sendUpdate(0, "User already exists");
      res.end(); // End the SSE stream properly
      return;
    }

    const Random_Password = generateSecurePassword();
    const hashedPassword = await Bcrypt.hash(Random_Password, 10);

    //send password to mail
    sendUpdate(1, "sending temporary password to mail");

    await sendTemporaryPasswordEmail(email, Random_Password);

    const tempdata = await prisma.enquiry.findFirst({
      where: {
        email,
      },
      select: {
        AddressLine: true,
        vill: true,
        id: true,
      },
    });

    if (!tempdata) {
      sendUpdate(0, "no data found");
      res.end(); // End the SSE stream properly
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const userId = await getNextId(tx, "UserId");
      const centerCode = await getNextId(tx, "CenterCode");
      const newUser = await tx.user.create({
        data: {
          email,
          id: userId,
          password: hashedPassword,
          name,
          enquiryid: tempdata.id,
        },
      });

      await tx.center.create({
        data: {
          code: centerCode,
          adminid: newUser.id,
          address: tempdata!.AddressLine,
          Centername: `${tempdata?.vill} MISSION NATIONAL YOUTH COMPUTER CENTER`,
        },
      });
    });

    sendUpdate(2, "center created");

    await prisma.enquiry.update({
      where: {
        id: tempdata.id,
      },
      data: {
        verified: true,
      },
    });

    res.end();
  } catch (error) {
    logger.error("Error in VerifyEnquiry:", error);
    sendUpdate(-1, "An error occurred");
    res.end();
  }

  req.on("close", () => {
    logger.info("Client disconnected");
    res.end();
  });
}

export async function ChangePassword(req: Request, res: Response) {
  const { oldPassword, newPassword, email } = req.body;

  const data = await prisma.user.findFirst({
    where: {
      email,
    },
  });

  if (!data) {
    res.json({ message: "no user found" });
    return;
  }

  const isPasswordValid = await Bcrypt.compare(oldPassword, data.password);

  if (!isPasswordValid) {
    res.status(200).json({ error: "Invalid credentials" });
    return;
  }

  const hashedPassword = await Bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: {
      id: data.id,
    },
    data: {
      password: hashedPassword,
    },
  });
  res.json({ success: true });
}

export async function SendResetLink(req: Request, res: Response) {
  const { email } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  // Generate a secure reset token
  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour expiry

  await prisma.user.update({
    where: { email },
    data: { resetToken, resetTokenExpiry },
  });

  const resetLink = `${process.env.CORSORIGIN}/resetpassword?token=${resetToken}`;

  await sendPasswordResetEmail(email, resetLink);

  res.json({
    success: true,
    message: "Reset password link sent to your email",
  });
}

export async function ResetPassword(req: Request, res: Response) {
  const { token } = req.params;
  const { newPassword } = req.body;

  const user = await prisma.user.findFirst({
    where: { resetToken: token, resetTokenExpiry: { gt: new Date() } },
  });

  if (!user) {
    res.status(400).json({ message: "Invalid or expired token" });
    return;
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null,
    },
  });

  res.json({ success: true, message: "Password reset successful" });
}

export async function subjectAdd(req: Request, res: Response) {
  const { c, cid } = req.body;

  await prisma.course.update({
    where: {
      id: parseInt(cid),
    },
    data: {
      subjects: {
        createMany: {
          data: c.map((s: any) => ({
            SubName: s.name,
            theoryFullMarks: parseInt(s.theory),
            practFullMarks: parseInt(s.practical),
          })),
        },
      },
    },
  });

  res.json({ success: true });
}
export const fetchAllCourseWithSub = async (req: Request, res: Response) => {
  const data = await prisma.course.findMany({
    where: {},
    select: {
      CName: true,
      subjects: true,
    },
  });

  res.json(data);
};
export async function noticefetch(req: Request, res: Response) {
  try {
    const cacheKey = "notices";
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      res.json(JSON.parse(cachedData));
      return;
    }

    const notices = await prisma.notices.findMany({
      where: { upto: { gt: new Date() } },
      orderBy: { upto: "desc" },
    });

    await redisClient.set(cacheKey, JSON.stringify(notices)); // Cache for 1 hour
    res.json(notices);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch notices" });
  }
}

export async function noticecreate(req: Request, res: Response) {
  const { subject: heading, details: body, expiryDate: upto } = req.body;

  await prisma.notices.create({
    data: {
      body,
      heading,
      upto: new Date(upto),
    },
  });

  await redisClient.del("notices");

  res.json({ success: true });
}

export async function Coordinator_Update(req: Request, res: Response) {
  const { name, dist, imageUrl } = req.body;

  await prisma.district.create({
    data: {
      imgUrl: imageUrl,
      name: name,
      DistrictName: dist,
    },
  });

  res.json({ success: true });
}

export async function Certi_fetch(req: Request, res: Response) {
  const { filteredVal } = req.body;

  const data = await prisma.enrollment.findFirst({
    where: {
      EnrollmentNo: filteredVal,
    },
    select: {
      certificateLink: true,
    },
  });

  res.json(data);
}

export async function Delete_Admin(req: Request, res: Response) {
  const { id } = req.body;

  await prisma.user.update({
    where: {
      id,
    },
    data: {
      isdeleted: true,
    },
  });

  res.json({ success: true });
}

export async function All_Center(req: Request, res: Response) {
  const data = await prisma.center.findMany({
    where: {},
    select: {
      Centername: true,
      code: true,
      admin: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  res.json(data);
}

export async function Fetch_Coordinator(req: Request, res: Response) {
  const id = req.userId;

  if (!id) {
    res.json({ success: false });
    return;
  }

  const data = await prisma.user.findFirst({
    where: {
      id,
    },
    select: {
      enquiry: {
        select: {
          dist: true,
        },
      },
    },
  });

  if (!data?.enquiry?.dist) {
    res.json({ success: false });
    return;
  }

  const data2 = await prisma.district.findFirst({
    where: {
      DistrictName: data?.enquiry?.dist,
    },
  });

  res.json({ success: true, data2 });
}

export const updateEnquiry = async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  const { editedData } = req.body;

  const updated = await prisma.enquiry.update({
    where: { id },
    data: {
      name: editedData.name,
      email: editedData.email,
      father: editedData.father,
      coName: editedData.coName,
      dob: new Date(editedData.dob),
      mobileNo: editedData.mobileNo,
      AddressLine: editedData.AddressLine,
      vill: editedData.vill,
      po: editedData.po,
      ps: editedData.ps,
      pin: editedData.pin,
      state: editedData.state,
      dist: editedData.dist,
      nationality: editedData.nationality,
      sex: editedData.sex,
      category: editedData.category,
      idProof: editedData.idProof,
      idProofNo: editedData.idProofNo,
      eduqualification: editedData.eduqualification,
      bathroom: editedData.bathroom,
      tradeLicense: editedData.tradeLicense,
      squareFit: editedData.squareFit,
      houseRoomNo: editedData.houseRoomNo,
      Subscription: new Date(editedData.Subscription),
    },
  });

  res.status(200).json({ success: true, updated });
};

export const updateMarksheet = async (req: Request, res: Response) => {
  const { sendData } = req.body;

  await prisma.marks.update({
    where: {
      id: sendData.id,
    },
    data: {
      marks: sendData.marks,
      percentage: sendData.percentage,
      grade: sendData.grade,
      remarks: sendData.remarks,
    },
  });

  res.json({ success: true });
};

// FIXME pic storage khacche ki na!!!!
