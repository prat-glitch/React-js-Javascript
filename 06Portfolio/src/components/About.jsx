import React from 'react';
import { 
  Typography, 
  Container, 
  Grid, 
  Card, 
  CardContent, 
  Box, 
  Avatar,
  Chip,
  Divider
} from '@mui/material';
import { 
  Code as CodeIcon, 
  Palette as DesignIcon, 
  Speed as SpeedIcon,
  Person as PersonIcon,
  Work as WorkIcon,
  Star as StarIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';

const About = () => {
  const features = [
    {
      icon: <CodeIcon sx={{ fontSize: 32 }} />,
title: 'Competitive Programming',
description: 'Expert in algorithms and data structures, solving complex problems efficiently.',
color: 'linear-gradient(135deg, #5f72bd 0%, #9f5de2 100%)', // Slightly different purple/blue gradient
stats: 'solved 300+ problems across platforms'
    },
    {
      icon: <DesignIcon sx={{ fontSize: 32 }} />,
      title: 'Modern Design',
      description: 'Creating beautiful, intuitive user interfaces with attention to detail and user experience.',
      color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      stats: '50+ projects designed'
    },
    {
      icon: <SpeedIcon sx={{ fontSize: 32 }} />,
      title: 'Performance Optimization',
      description: 'Optimizing applications for speed and performance to deliver the best user experience.',
      color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      stats: '99% uptime achieved'
    }
  ];

  const achievements = [
    { number: '10+', label: 'Projects Completed', icon: <WorkIcon /> },
    { number: '2+', label: 'Years Experience', icon: <TrendingUpIcon /> },
    { number: '4+', label:'hackathons perticipated', icon: <StarIcon /> },
  ];


  return (
    <section 
      id="about" 
      style={{
        background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
        padding: '120px 0',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Background Pattern */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.1) 0%, transparent 50%)',
        pointerEvents: 'none'
      }} />
      
      <Container maxWidth="lg" style={{ position: 'relative', zIndex: 1 }}>
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
          viewport={{ once: true }}
          style={{ textAlign: 'center', marginBottom: '80px' }}
        >
          <motion.div
            initial={{ scale: 0.8 }}
            whileInView={{ scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            style={{ marginBottom: '24px' }}
          >
            <Chip
              icon={<PersonIcon />}
              label="About Me"
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                fontWeight: 600,
                fontSize: '14px',
                padding: '8px 16px',
                height: '40px',
                '& .MuiChip-icon': { color: 'white' }
              }}
            />
          </motion.div>
          
          <Typography 
            variant="h2" 
            sx={{ 
              fontSize: { xs: '2.5rem', md: '3.5rem' },
              fontWeight: 700,
              color: 'white',
              marginBottom: '24px',
              lineHeight: 1.2
            }}
          >
            About <span style={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>Me</span>
          </Typography>
          
          <Typography 
            variant="body1" 
            sx={{ 
              color: '#a1a1aa',
              fontSize: '18px',
              maxWidth: '700px',
              margin: '0 auto',
              lineHeight: 1.6
            }}
          >
            I'm a passionate full-stack developer with 2+ years of experience creating digital experiences 
            that are not only functional but also beautiful. I love turning complex problems into simple, 
            elegant solutions that make a real impact.
          </Typography>
        </motion.div>

        {/* Features Section - Horizontal Layout */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
          viewport={{ once: true }}
          style={{ marginBottom: '80px' }}
        >
          <Box sx={{ 
            display: 'flex', 
            gap: 4, 
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: 'stretch'
          }}>
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ 
                  duration: 0.8, 
                  delay: index * 0.2,
                  type: "spring",
                  stiffness: 100
                }}
                viewport={{ once: true }}
                whileHover={{ y: -8, scale: 1.02 }}
                style={{ flex: 1 }}
              >
                <Card 
                  sx={{
                    height: '100%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '20px',
                    overflow: 'hidden',
                    position: 'relative',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(255, 255, 255, 0.2)'
                    }
                  }}
                >
                  <Box sx={{
                    background: feature.color,
                    padding: '24px',
                    textAlign: 'center',
                    position: 'relative'
                  }}>
                    <Avatar sx={{
                      width: 60,
                      height: 60,
                      margin: '0 auto 16px',
                      background: 'rgba(255, 255, 255, 0.2)',
                      backdropFilter: 'blur(10px)'
                    }}>
                      {feature.icon}
                    </Avatar>
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        color: 'white', 
                        fontWeight: 700,
                        fontSize: '18px',
                        marginBottom: '8px'
                      }}
                    >
                      {feature.title}
                    </Typography>
                    <Chip
                      label={feature.stats}
                      size="small"
                      sx={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        color: 'white',
                        fontWeight: 600,
                        fontSize: '11px'
                      }}
                    />
                  </Box>

                  <CardContent sx={{ padding: '24px' }}>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: '#a1a1aa',
                        lineHeight: 1.6,
                        fontSize: '14px'
                      }}
                    >
                      {feature.description}
                    </Typography>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </Box>
        </motion.div>

        {/* Achievements Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
          viewport={{ once: true }}
          style={{ marginBottom: '80px' }}
        >
          <Card 
            sx={{
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '24px',
              padding: '40px',
              textAlign: 'center'
            }}
          >
            <Typography 
              variant="h4" 
              sx={{ 
                color: 'white', 
                fontWeight: 700,
                fontSize: '28px',
                marginBottom: '40px'
              }}
            >
              My Achievements
            </Typography>
            
            <Grid container spacing={3}>
              {achievements.map((achievement, index) => (
                <Grid item xs={6} md={3} key={index}>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ 
                      duration: 0.6, 
                      delay: index * 0.1,
                      type: "spring",
                      stiffness: 200
                    }}
                    viewport={{ once: true }}
                    whileHover={{ 
                      scale: 1.05, 
                      y: -4,
                      transition: { duration: 0.2 }
                    }}
                  >
                    <Box sx={{
                      textAlign: 'center',
                      padding: '24px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '16px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.2)'
                      }
                    }}>
                      <Avatar sx={{
                        width: 60,
                        height: 60,
                        margin: '0 auto 16px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                      }}>
                        {achievement.icon}
                      </Avatar>
                      <Typography 
                        variant="h3" 
                        sx={{ 
                          color: 'white',
                          fontWeight: 700,
                          fontSize: '32px',
                          marginBottom: '8px',
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text'
                        }}
                      >
                        {achievement.number}
                      </Typography>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: '#a1a1aa',
                          fontWeight: 500,
                          fontSize: '14px'
                        }}
                      >
                        {achievement.label}
                      </Typography>
                    </Box>
                  </motion.div>
                </Grid>
              ))}
            </Grid>
          </Card>
        </motion.div>

      </Container>
    </section>
  );
};

export default About;
